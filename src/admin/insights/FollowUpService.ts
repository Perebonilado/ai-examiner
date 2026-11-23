import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { Op } from 'sequelize';
import { freePlanEasyReadSecondsPerMonth } from 'src/constants';
import { MailerService } from 'src/integrations/mailer/services/MailerService';
import { generateUUID } from 'src/utils';
import { isOwnerEmail, memberEmails } from '../adminAccess';
import { ACTION_ROWS_SQL, USAGE_ROWS_SQL } from '../analytics';
import { classifySendError } from '../services/CampaignSender';
import { CampaignService } from '../services/CampaignService';
import { EmailLinkService } from '../services/EmailLinkService';
import { REAL_EMAIL_SQL, fullName, iso, select } from '../sql';
import { addDays, startOfWatDay, watDay } from '../time';
import { FALLBACK_BETA, claude, jsonOf } from './claude';
import { InsightsJobs } from './InsightsJobs';
import { TEST_TYPES } from './items';
import { LabelService } from './LabelService';
import { AiBatchModel, FollowUpModel, FollowUpRuleModel } from './models';
import { FOLLOW_UP_SCHEMA, FOLLOW_UP_SYSTEM, INSIGHTS_MODEL } from './prompts';

const SITE = 'https://aiexaminer.app';
const DAY = 86_400_000;
/** At most this many new suggestions per run, and per rule. */
const MAX_PER_RUN = 30;
const MAX_PER_RULE = 10;
/** One follow-up per person per week; the same rule at most once a month. */
const PER_PERSON_GAP_DAYS = 7;
const SAME_RULE_GAP_DAYS = 30;
/** Drafts written at once when drafting on demand. */
const DRAFT_CONCURRENCY = 4;

export interface RuleDef {
  key: string;
  title: string;
  /** When it fires, in plain words. */
  when: string;
  /** What the email should do. */
  aim: string;
}

export const RULES: RuleDef[] = [
  {
    key: 'frustrated',
    title: 'Had a bad experience',
    when: 'Claude labelled a chat or test from the last 7 days as frustrated',
    aim: 'A personal check-in that helps with what went wrong, never a sales line',
  },
  {
    key: 'test_abandoned',
    title: 'Left a test half-done',
    when: 'Stopped a test part-way 2–10 days ago and hasn’t used the app since',
    aim: 'Invite them back to finish the test, by name',
  },
  {
    key: 'struggling_topic',
    title: 'Struggling with a topic',
    when: 'Scored under 50% on two or more tests in the last 3 weeks',
    aim: 'Encourage them and point to a better way to study that topic',
  },
  {
    key: 'gone_quiet',
    title: 'Gone quiet',
    when: 'Used the app on 2+ days this month, then nothing for 3–14 days',
    aim: 'Bring them back to where they left off',
  },
  {
    key: 'stuck_start',
    title: 'Stuck at the start',
    when: 'Signed up 1–5 days ago and never uploaded a document',
    aim: 'Show how to get a first test from their lecture notes',
  },
  {
    key: 'easy_read_limit',
    title: 'Out of free Easy Read',
    when: 'On the free plan, used this month’s Easy Read minutes, active this week',
    aim: 'Explain what a plan unlocks, helpfully',
  },
  {
    key: 'power_user',
    title: 'Power user',
    when: 'Among the 10 most active students this month, active this week',
    aim: 'Thank them, and invite them to reply with a line on how AI Examiner helps them (replies reach the team). The button takes them back to their documents',
  },
];
const RULE = new Map(RULES.map((r) => [r.key, r]));

/** An email the admin asked the assistant to write (not one of the daily rules). */
const MANUAL: RuleDef = {
  key: 'manual',
  title: 'From the assistant',
  when: 'An admin asked the assistant to write to this student',
  aim: 'Do what the admin asked (see purpose in the facts)',
};
const ruleOf = (key: string) => RULE.get(key) ?? MANUAL;

/** The button's words when Claude's own label can't be used. */
const BUTTON_LABELS: Record<string, string> = {
  home: 'Open your documents',
  upload: 'Upload a document',
  document: 'Open your document',
  test: 'Finish your test',
  easy_read: 'Open in Easy Read',
  pricing: 'See the plans',
};

const TEST_SLUG: Record<number, string> = {
  3: 'multiple-choice',
  4: 'flash-cards',
  5: 'multiple-true-false',
  6: 'oral-(viva)',
  7: 'essay',
};

interface Candidate {
  userId: string;
  rule: string;
  facts: Record<string, unknown>;
}

const num = (v: unknown) => Number(v ?? 0) || 0;
const dayOf = (v: unknown) => (v ? watDay(new Date(iso(v)!)) : null);

/** Follow-up suggestions: rules pick people, Claude drafts the email, an admin approves it. */
@Injectable()
export class FollowUpService implements OnModuleInit {
  private drafting = false;

  constructor(
    @Inject(CampaignService) private campaigns: CampaignService,
    @Inject(MailerService) private mailer: MailerService,
    @Inject(LabelService) private labels: LabelService,
    @Inject(InsightsJobs) private jobs: InsightsJobs,
    @Inject(EmailLinkService) private links: EmailLinkService,
  ) {}

  onModuleInit() {
    this.labels.registerImporter('drafts', (batchId) =>
      this.importDrafts(batchId),
    );
    this.jobs.schedule({
      name: 'follow_ups',
      hour: 5,
      run: async () => {
        await this.trackReturns();
        await this.wakeSnoozed();
        const created = await this.findCandidates();
        if (created.length) await this.submitDraftBatch(created);
      },
    });
  }

  /* ---------- Rules ---------- */

  async ruleSettings() {
    const rows = await FollowUpRuleModel.findAll();
    const map = new Map(rows.map((r) => [r.rule, r]));
    return RULES.map((r) => ({
      ...r,
      enabled: map.get(r.key)?.enabled ?? true,
      autoSend: map.get(r.key)?.autoSend ?? false,
    }));
  }

  async updateRule(
    rule: string,
    body: { enabled?: unknown; autoSend?: unknown },
    by: string | null,
  ) {
    if (!RULE.has(rule))
      throw new HttpException('Unknown rule', HttpStatus.NOT_FOUND);
    const current = await FollowUpRuleModel.findByPk(rule);
    await FollowUpRuleModel.upsert({
      rule,
      enabled:
        typeof body.enabled === 'boolean'
          ? body.enabled
          : (current?.enabled ?? true),
      autoSend:
        typeof body.autoSend === 'boolean'
          ? body.autoSend
          : (current?.autoSend ?? false),
      updatedBy: by,
      updatedOn: new Date(),
    } as FollowUpRuleModel);
    return this.ruleSettings();
  }

  /* ---------- Finding people ---------- */

  private async lastActivity(userIds: string[], since: Date) {
    if (!userIds.length) return new Map<string, Date>();
    const rows = await select<{ user_id: string; last_at: Date }>(
      `SELECT x.user_id, MAX(x.at) AS last_at FROM (${USAGE_ROWS_SQL}) x WHERE x.user_id IN (:ids) GROUP BY x.user_id`,
      {
        aFrom: since,
        aTo: new Date(),
        aFromDay: watDay(since),
        aToDay: watDay(),
        ids: userIds,
      },
    );
    return new Map(rows.map((r) => [r.user_id, new Date(iso(r.last_at)!)]));
  }

  private async rule_stuck_start(now: Date): Promise<Candidate[]> {
    const rows = await select<{ id: string; created_on: Date }>(
      `SELECT u.id, u.created_on FROM user u
       WHERE u.role = 'user' AND u.created_on >= :from AND u.created_on < :to AND ${REAL_EMAIL_SQL}
         AND NOT EXISTS (SELECT 1 FROM course_document d WHERE d.user_id = u.id)
       ORDER BY u.created_on DESC LIMIT 40`,
      {
        from: new Date(now.getTime() - 5 * DAY),
        to: new Date(now.getTime() - DAY),
      },
    );
    return rows.map((r) => ({
      userId: r.id,
      rule: 'stuck_start',
      facts: { signedUpOn: dayOf(r.created_on) },
    }));
  }

  private async rule_gone_quiet(now: Date): Promise<Candidate[]> {
    const rows = await select<{ user_id: string; days: number; last_at: Date }>(
      `SELECT x.user_id, COUNT(DISTINCT DATE(DATE_ADD(x.at, INTERVAL 1 HOUR))) AS days, MAX(x.at) AS last_at
       FROM (${USAGE_ROWS_SQL}) x GROUP BY x.user_id
       HAVING days >= 2 AND last_at < :quiet AND last_at >= :oldest ORDER BY days DESC LIMIT 40`,
      {
        aFrom: new Date(now.getTime() - 30 * DAY),
        aTo: now,
        aFromDay: addDays(watDay(now), -30),
        aToDay: watDay(now),
        quiet: new Date(now.getTime() - 3 * DAY),
        oldest: new Date(now.getTime() - 14 * DAY),
      },
    );
    if (!rows.length) return [];
    // What they did last: their most recent document.
    const docs = await select<{ user_id: string; id: string; title: string }>(
      `SELECT d.user_id, d.id, d.title FROM course_document d
       JOIN (SELECT user_id, MAX(created_on) AS m FROM course_document WHERE user_id IN (:ids) GROUP BY user_id) x
         ON x.user_id = d.user_id AND x.m = d.created_on`,
      { ids: rows.map((r) => r.user_id) },
    );
    const lastDoc = new Map(docs.map((d) => [d.user_id, d]));
    return rows.map((r) => ({
      userId: r.user_id,
      rule: 'gone_quiet',
      facts: {
        activeDaysThisMonth: num(r.days),
        lastActiveOn: dayOf(r.last_at),
        latestDocument: lastDoc.get(r.user_id)
          ? {
              id: lastDoc.get(r.user_id)!.id,
              title: lastDoc.get(r.user_id)!.title,
            }
          : null,
      },
    }));
  }

  private async rule_test_abandoned(now: Date): Promise<Candidate[]> {
    const rows = await select<any>(
      `SELECT qp.user_id, qp.id AS attempt, qp.question_id, qp.modified_on,
              JSON_LENGTH(JSON_UNQUOTE(qp.data)) AS answered, JSON_LENGTH(JSON_UNQUOTE(q.data)) AS total,
              q.question_type_id AS t, q.course_document_id, d.title
       FROM question_progress qp JOIN question q ON q.id = qp.question_id
       LEFT JOIN course_document d ON d.id = q.course_document_id
       WHERE qp.status <> 'submitted' AND qp.modified_on >= :from AND qp.modified_on < :to
       HAVING answered >= 3 AND answered < total ORDER BY qp.modified_on DESC LIMIT 60`,
      {
        from: new Date(now.getTime() - 10 * DAY),
        to: new Date(now.getTime() - 2 * DAY),
      },
    );
    const last = await this.lastActivity(
      [...new Set(rows.map((r) => r.user_id))],
      new Date(now.getTime() - 11 * DAY),
    );
    const seen = new Set<string>();
    const out: Candidate[] = [];
    for (const r of rows) {
      if (seen.has(r.user_id)) continue;
      const stoppedAt = new Date(iso(r.modified_on)!);
      // Used the app since (beyond the same sitting)? Then they're not lost.
      if (
        (last.get(r.user_id)?.getTime() ?? 0) >
        stoppedAt.getTime() + 3 * 3600_000
      )
        continue;
      seen.add(r.user_id);
      out.push({
        userId: r.user_id,
        rule: 'test_abandoned',
        facts: {
          test: {
            id: r.question_id,
            type: TEST_TYPES[num(r.t)] ?? 'Test',
            typeId: num(r.t),
            answered: num(r.answered),
            questions: num(r.total),
            stoppedOn: dayOf(r.modified_on),
          },
          document: { id: r.course_document_id, title: r.title },
        },
      });
    }
    return out;
  }

  private async rule_frustrated(now: Date): Promise<Candidate[]> {
    const rows = await select<any>(
      `SELECT l.user_id, l.kind, l.item_key, l.summary, l.quote, l.issues, l.details, l.document_id, l.occurred_on, d.title
       FROM ai_label l LEFT JOIN course_document d ON d.id = l.document_id
       WHERE l.status = 'done' AND COALESCE(l.corrected_mood, l.mood) = 'frustrated' AND l.confidence IN ('high', 'medium')
         AND l.kind IN ('chat', 'test') AND l.occurred_on >= :from
       ORDER BY l.confidence = 'high' DESC, l.occurred_on DESC LIMIT 40`,
      { from: new Date(now.getTime() - 7 * DAY) },
    );
    const seen = new Set<string>();
    return rows
      .filter((r) => r.user_id && !seen.has(r.user_id) && seen.add(r.user_id))
      .map((r) => {
        const details = JSON.parse(r.details || '{}');
        return {
          userId: r.user_id,
          rule: 'frustrated',
          facts: {
            where:
              r.kind === 'chat'
                ? 'document chat'
                : `${details.testType ?? 'a'} test`,
            on: dayOf(r.occurred_on),
            whatHappened: r.summary,
            problems: JSON.parse(r.issues || '[]'),
            document: r.document_id
              ? { id: r.document_id, title: r.title }
              : null,
            test:
              r.kind === 'test'
                ? {
                    id: details.testId,
                    type: details.testType,
                    score: details.score,
                  }
                : null,
            topicsMissed: details.struggles ?? [],
            labelKey: `${r.kind}:${r.item_key}`,
          },
        };
      });
  }

  private async rule_struggling_topic(now: Date): Promise<Candidate[]> {
    const rows = await select<{
      user_id: string;
      n: number;
      avg: number;
      last_q: string;
    }>(
      `SELECT s.user_id, COUNT(*) AS n, AVG(s.percentage_score) AS avg,
              SUBSTRING_INDEX(GROUP_CONCAT(s.question_id ORDER BY s.created_on DESC), ',', 1) AS last_q
       FROM score s WHERE s.created_on >= :from AND s.percentage_score < 50
       GROUP BY s.user_id HAVING n >= 2 ORDER BY n DESC LIMIT 30`,
      { from: new Date(now.getTime() - 21 * DAY) },
    );
    if (!rows.length) return [];
    const ids = rows.map((r) => r.user_id);
    const [struggles, lastTests] = await Promise.all([
      select<{ user_id: string; details: string }>(
        `SELECT user_id, details FROM ai_label WHERE kind = 'test' AND status = 'done' AND user_id IN (:ids) AND occurred_on >= :from`,
        { ids, from: new Date(now.getTime() - 21 * DAY) },
      ),
      select<{
        id: string;
        t: number;
        course_document_id: string;
        title: string;
      }>(
        `SELECT q.id, q.question_type_id AS t, q.course_document_id, d.title FROM question q
         LEFT JOIN course_document d ON d.id = q.course_document_id WHERE q.id IN (:ids)`,
        { ids: rows.map((r) => r.last_q) },
      ),
    ]);
    const topics = new Map<string, Record<string, number>>();
    for (const l of struggles) {
      const d = JSON.parse(l.details || '{}');
      const t = topics.get(l.user_id) ?? {};
      for (const s of d.struggles ?? []) t[s] = (t[s] ?? 0) + 1;
      topics.set(l.user_id, t);
    }
    const testOf = new Map(lastTests.map((t) => [t.id, t]));
    return rows.map((r) => {
      const t = testOf.get(r.last_q);
      return {
        userId: r.user_id,
        rule: 'struggling_topic',
        facts: {
          lowScores: num(r.n),
          averageOfThoseScores: Math.round(Number(r.avg)),
          topicsMissed: Object.entries(topics.get(r.user_id) ?? {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([k]) => k),
          document: t ? { id: t.course_document_id, title: t.title } : null,
          test: t
            ? {
                id: t.id,
                type: TEST_TYPES[num(t.t)] ?? 'Test',
                typeId: num(t.t),
              }
            : null,
        },
      };
    });
  }

  private async rule_easy_read_limit(now: Date): Promise<Candidate[]> {
    const month = new Date(now).toISOString().slice(0, 7);
    const rows = await select<{ user_id: string; seconds_used: number }>(
      `SELECT e.user_id, e.seconds_used FROM easy_read_usage e
       WHERE e.month = :month AND e.seconds_used >= :limit AND e.last_active_on >= :from
         AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = e.user_id)
         AND NOT EXISTS (SELECT 1 FROM one_time_subscription o WHERE o.user_id = e.user_id AND o.expires_on > UTC_TIMESTAMP())
       LIMIT 30`,
      {
        month,
        limit: freePlanEasyReadSecondsPerMonth,
        from: new Date(now.getTime() - 7 * DAY),
      },
    );
    return rows.map((r) => ({
      userId: r.user_id,
      rule: 'easy_read_limit',
      facts: {
        freeMinutesUsed: Math.round(num(r.seconds_used) / 60),
        plan: 'free',
      },
    }));
  }

  private async rule_power_user(now: Date): Promise<Candidate[]> {
    const rows = await select<{
      user_id: string;
      n: number;
      reading: number;
      last_at: Date;
    }>(
      `SELECT x.user_id, COUNT(*) AS n, SUM(x.secs) AS reading, MAX(x.at) AS last_at FROM (${ACTION_ROWS_SQL}) x
       GROUP BY x.user_id HAVING last_at >= :recent ORDER BY n DESC LIMIT 10`,
      {
        aFrom: new Date(now.getTime() - 30 * DAY),
        aTo: now,
        recent: new Date(now.getTime() - 7 * DAY),
      },
    );
    return rows.map((r) => ({
      userId: r.user_id,
      rule: 'power_user',
      facts: {
        actionsThisMonth: num(r.n),
        easyReadMinutesThisMonth: Math.round(num(r.reading) / 60),
      },
    }));
  }

  /** Runs every enabled rule and saves new suggestions (status "drafting"). Returns them. */
  async findCandidates(): Promise<FollowUpModel[]> {
    const now = new Date();
    const settings = await this.ruleSettings();
    const enabled = new Set(
      settings.filter((s) => s.enabled).map((s) => s.key),
    );
    const finders: Record<string, (n: Date) => Promise<Candidate[]>> = {
      frustrated: (n) => this.rule_frustrated(n),
      test_abandoned: (n) => this.rule_test_abandoned(n),
      struggling_topic: (n) => this.rule_struggling_topic(n),
      gone_quiet: (n) => this.rule_gone_quiet(n),
      stuck_start: (n) => this.rule_stuck_start(n),
      easy_read_limit: (n) => this.rule_easy_read_limit(n),
      power_user: (n) => this.rule_power_user(n),
    };
    const found: Candidate[] = [];
    for (const r of RULES) {
      if (!enabled.has(r.key)) continue;
      try {
        found.push(...(await finders[r.key](now)));
      } catch (error) {
        console.error(`follow-ups: rule ${r.key} failed`, error?.message);
      }
    }
    if (!found.length) return [];

    const ids = [...new Set(found.map((c) => c.userId))];
    const [people, recent, prefs, team] = await Promise.all([
      select<{
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        role: string;
        created_on: Date;
      }>(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.created_on FROM user u WHERE u.id IN (:ids) AND u.role = 'user' AND ${REAL_EMAIL_SQL}`,
        { ids },
      ),
      select<{
        user_id: string;
        rule: string;
        created_on: Date;
        status: string;
      }>(
        `SELECT user_id, rule, created_on, status FROM follow_up WHERE user_id IN (:ids) AND created_on >= :since`,
        { ids, since: new Date(now.getTime() - SAME_RULE_GAP_DAYS * DAY) },
      ),
      select<{ user_id: string }>(
        `SELECT user_id FROM email_preference WHERE user_id IN (:ids) AND (marketing_opt_out = 1 OR bounced = 1)`,
        { ids },
      ),
      memberEmails().catch(() => new Set<string>()),
    ]);
    const person = new Map(people.map((p) => [p.id, p]));
    const blocked = new Set(prefs.map((p) => p.user_id));
    const facts = await this.studentFacts(ids);
    const created: FollowUpModel[] = [];
    const perRule: Record<string, number> = {};
    const taken = new Set<string>();
    for (const c of found) {
      if (created.length >= MAX_PER_RUN) break;
      const p = person.get(c.userId);
      if (!p || blocked.has(c.userId) || taken.has(c.userId)) continue;
      const email = (p.email || '').toLowerCase();
      if (isOwnerEmail(email) || team.has(email)) continue;
      const theirs = recent.filter((r) => r.user_id === c.userId);
      if (
        theirs.some(
          (r) =>
            now.getTime() - new Date(iso(r.created_on)!).getTime() <
            PER_PERSON_GAP_DAYS * DAY,
        )
      )
        continue;
      if (theirs.some((r) => r.rule === c.rule)) continue;
      if ((perRule[c.rule] ?? 0) >= MAX_PER_RULE) continue;
      perRule[c.rule] = (perRule[c.rule] ?? 0) + 1;
      taken.add(c.userId);
      const row = await FollowUpModel.create({
        id: generateUUID(),
        userId: c.userId,
        rule: c.rule,
        status: 'drafting',
        evidence: JSON.stringify({
          firstName: (p.first_name || '').trim().split(/\s+/)[0] || null,
          name: fullName(p.first_name, p.last_name, p.role),
          ...facts.get(c.userId),
          ...c.facts,
        }),
        auto: false,
        createdOn: now,
        updatedOn: now,
      } as FollowUpModel);
      created.push(row);
    }
    return created;
  }

  /** The everyday facts about a student that every draft can use. */
  private async studentFacts(ids: string[]) {
    const map = new Map<string, Record<string, unknown>>();
    if (!ids.length) return map;
    const [rows, last] = await Promise.all([
      select<any>(
        `SELECT u.id, u.created_on,
                (SELECT COUNT(*) FROM course_document d WHERE d.user_id = u.id) AS documents,
                (SELECT COUNT(*) FROM question q WHERE q.user_id = u.id) AS tests,
                (SELECT COUNT(*) FROM score s WHERE s.user_id = u.id) AS finished,
                (EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id)
                  OR EXISTS (SELECT 1 FROM one_time_subscription o WHERE o.user_id = u.id AND o.expires_on > UTC_TIMESTAMP())) AS paid
         FROM user u WHERE u.id IN (:ids)`,
        { ids },
      ),
      this.lastActivity(ids, new Date(Date.now() - 90 * DAY)),
    ]);
    for (const r of rows)
      map.set(r.id, {
        signedUpOn: dayOf(r.created_on),
        lastActiveOn: last.get(r.id) ? watDay(last.get(r.id)!) : null,
        plan: Number(r.paid) ? 'paid' : 'free',
        documentsUploaded: num(r.documents),
        testsMade: num(r.tests),
        testsFinished: num(r.finished),
      });
    return map;
  }

  /* ---------- Drafting ---------- */

  private draftPrompt(f: FollowUpModel, instruction?: string) {
    const rule = ruleOf(f.rule);
    const evidence = JSON.parse(f.evidence);
    const aim =
      f.rule === 'manual' && evidence.purpose ? evidence.purpose : rule.aim;
    return [
      `Rule: ${rule.title}. It fires when: ${rule.when}. The email should: ${aim}.`,
      `Today (Lagos time): ${watDay()}.`,
      '',
      'Facts about the student (JSON):',
      JSON.stringify(evidence, null, 1),
      instruction
        ? `\nThe admin asked for this change to the previous draft: ${instruction}`
        : '',
      f.body && instruction
        ? `\nPrevious draft:\nSubject: ${f.subject}\n${f.body}`
        : '',
    ].join('\n');
  }

  private draftRequest(f: FollowUpModel, instruction?: string) {
    return {
      model: INSIGHTS_MODEL,
      max_tokens: 4000,
      system: [
        {
          type: 'text' as const,
          text: FOLLOW_UP_SYSTEM,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      messages: [
        { role: 'user' as const, content: this.draftPrompt(f, instruction) },
      ],
      output_config: {
        effort: 'low' as const,
        format: { type: 'json_schema' as const, schema: FOLLOW_UP_SCHEMA },
      },
    };
  }

  /** The button's address, built from the facts (Claude only picks which kind). */
  /** Where the button really goes: Claude's pick, or the nearest page when its target is missing. */
  private buttonTarget(button: string, evidence: any) {
    const doc = evidence?.document?.id ?? evidence?.latestDocument?.id;
    const test = evidence?.test;
    const home = { kind: 'home', url: `${SITE}/documents` };
    const docPage = doc
      ? { kind: 'document', url: `${SITE}/questions/view-questions/${doc}` }
      : home;
    switch (button) {
      case 'upload':
        return { kind: 'upload', url: `${SITE}/new-document` };
      case 'document':
        return docPage;
      case 'easy_read':
        return doc
          ? { kind: 'easy_read', url: `${SITE}/easy-read/${doc}` }
          : home;
      case 'test':
        return test?.id && TEST_SLUG[test.typeId]
          ? {
              kind: 'test',
              url: `${SITE}/questions/practise-questions/${TEST_SLUG[test.typeId]}/${test.id}`,
            }
          : docPage;
      case 'pricing':
        return { kind: 'pricing', url: `${SITE}/pricing` };
      default:
        return home;
    }
  }

  private async applyDraft(f: FollowUpModel, out: any) {
    const evidence = JSON.parse(f.evidence);
    const target = this.buttonTarget(out.button, evidence);
    await f.update({
      status: f.status === 'drafting' ? 'suggested' : f.status,
      reason: String(out.reason ?? '').slice(0, 600),
      subject: String(out.subject ?? '').slice(0, 190),
      headline: String(out.headline ?? '').slice(0, 190),
      body: String(out.body ?? ''),
      // When the page Claude picked isn't available, the label it wrote no longer fits.
      buttonLabel:
        target.kind === out.button && out.button_label
          ? String(out.button_label).slice(0, 60)
          : BUTTON_LABELS[target.kind],
      buttonUrl: target.url,
      error: null,
      updatedOn: new Date(),
    });
  }

  /** Drafts now with direct calls (a few at a time): for the "Find follow-ups now" button. */
  async draftNow(rows: FollowUpModel[]) {
    const queue = [...rows];
    const worker = async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        try {
          const res = await claude().beta.messages.create({
            ...this.draftRequest(f),
            betas: [FALLBACK_BETA],
            fallbacks: 'default',
          } as any);
          const out =
            (res as any).stop_reason === 'refusal'
              ? null
              : jsonOf<any>((res as any).content);
          if (out) await this.applyDraft(f, out);
          else
            await f.update({
              status: 'failed',
              error: 'Claude didn’t write a draft',
              updatedOn: new Date(),
            });
        } catch (error) {
          await f.update({
            status: 'failed',
            error: String(error?.message ?? 'Draft failed').slice(0, 290),
            updatedOn: new Date(),
          });
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(DRAFT_CONCURRENCY, rows.length) }, worker),
    );
    await this.autoSendReady();
  }

  /** Drafts in one batch at half price: for the overnight run. */
  async submitDraftBatch(rows: FollowUpModel[]) {
    const batch = await claude().messages.batches.create({
      requests: rows.map((f) => ({
        custom_id: `f_${f.id}`,
        params: this.draftRequest(f),
      })) as any,
    });
    const now = new Date();
    await AiBatchModel.create({
      id: batch.id,
      purpose: 'drafts',
      status: 'submitted',
      itemCount: rows.length,
      note: `Follow-up drafts · ${watDay()}`,
      requestedBy: 'nightly',
      submittedOn: now,
      updatedOn: now,
    } as AiBatchModel);
    await FollowUpModel.update(
      { batchId: batch.id },
      { where: { id: rows.map((r) => r.id) } },
    );
  }

  private async importDrafts(batchId: string) {
    const totals = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 };
    let done = 0;
    let failed = 0;
    for await (const result of await claude().messages.batches.results(
      batchId,
    )) {
      const id = result.custom_id.replace(/^f_/, '');
      const f = await FollowUpModel.findByPk(id);
      if (!f) continue;
      if (result.result.type !== 'succeeded') {
        failed++;
        await f.update({
          status: 'failed',
          error: 'Draft failed',
          updatedOn: new Date(),
        });
        continue;
      }
      const m = result.result.message;
      totals.input += Number(m.usage?.input_tokens ?? 0);
      totals.cacheWrite += Number(m.usage?.cache_creation_input_tokens ?? 0);
      totals.cacheRead += Number(m.usage?.cache_read_input_tokens ?? 0);
      totals.output += Number(m.usage?.output_tokens ?? 0);
      const out =
        m.stop_reason === 'refusal' ? null : jsonOf<any>(m.content as any);
      if (out) {
        done++;
        await this.applyDraft(f, out);
      } else {
        failed++;
        await f.update({
          status: 'failed',
          error: 'Claude didn’t write a draft',
          updatedOn: new Date(),
        });
      }
    }
    await AiBatchModel.update(
      {
        status: 'imported',
        doneCount: done,
        failedCount: failed,
        inputTokens: totals.input,
        cacheWriteTokens: totals.cacheWrite,
        cacheReadTokens: totals.cacheRead,
        outputTokens: totals.output,
        updatedOn: new Date(),
      },
      { where: { id: batchId } },
    );
    await this.autoSendReady();
  }

  /** "Find follow-ups now": runs the rules and drafts straight away, in the background. */
  async runNow() {
    if (this.drafting) return { created: 0, busy: true };
    this.drafting = true;
    try {
      await this.trackReturns().catch(() => undefined);
      await this.wakeSnoozed();
      const created = await this.findCandidates();
      void this.draftNow(created).finally(() => (this.drafting = false));
      return { created: created.length, busy: false };
    } catch (error) {
      this.drafting = false;
      throw error;
    }
  }

  /** One follow-up, as the admin pages show it. */
  async get(id: string) {
    const f = await this.find(id);
    return this.dto(f, await this.studentOf([f.userId]));
  }

  /**
   * A one-off email the admin asked the assistant for: drafted straight away and left for review.
   * Nothing is sent from here.
   */
  async createManual(userId: string, purpose: string, by: string | null) {
    const people = await this.studentOf([userId]);
    const p = people.get(userId);
    if (!p) throw new HttpException('Student not found', HttpStatus.NOT_FOUND);
    const [facts, prefs] = await Promise.all([
      this.studentFacts([userId]),
      select<{ marketing_opt_out: number; bounced: number }>(
        `SELECT marketing_opt_out, bounced FROM email_preference WHERE user_id = :u`,
        { u: userId },
      ),
    ]);
    const now = new Date();
    const row = await FollowUpModel.create({
      id: generateUUID(),
      userId,
      rule: 'manual',
      status: 'drafting',
      evidence: JSON.stringify({
        firstName: (p.first_name || '').trim().split(/\s+/)[0] || null,
        name: fullName(p.first_name, p.last_name, p.role),
        purpose: String(purpose || '').slice(0, 800),
        requestedBy: by,
        ...facts.get(userId),
      }),
      auto: false,
      createdOn: now,
      updatedOn: now,
    } as FollowUpModel);
    await this.draftNow([row]);
    await row.reload();
    return {
      ...this.dto(row, people),
      unsubscribed: !!(
        Number(prefs[0]?.marketing_opt_out) || Number(prefs[0]?.bounced)
      ),
    };
  }

  async redraft(id: string, instruction?: string) {
    const f = await this.find(id);
    if (!['suggested', 'failed', 'snoozed'].includes(f.status))
      throw new HttpException(
        'This follow-up can’t be redrafted now',
        HttpStatus.BAD_REQUEST,
      );
    const res = await claude().beta.messages.create({
      ...this.draftRequest(f, instruction?.slice(0, 500)),
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
    } as any);
    const out =
      (res as any).stop_reason === 'refusal'
        ? null
        : jsonOf<any>((res as any).content);
    if (!out)
      throw new HttpException(
        'Claude couldn’t write a new draft. Try again.',
        HttpStatus.BAD_GATEWAY,
      );
    if (f.status === 'failed') await f.update({ status: 'suggested' });
    await this.applyDraft(f, out);
    return this.dto(f, await this.studentOf([f.userId]));
  }

  /* ---------- Sending ---------- */

  private async find(id: string) {
    const f = await FollowUpModel.findByPk(id);
    if (!f)
      throw new HttpException('Follow-up not found', HttpStatus.NOT_FOUND);
    return f;
  }

  private async render(
    f: FollowUpModel,
    person: { userId: string; firstName: string | null },
    opts: { trackClicks?: boolean } = {},
  ) {
    const content = {
      colorSet: 'white_purple' as const,
      headline: f.headline || f.subject || 'A quick note',
      body: f.body || '',
      button: {
        label: f.buttonLabel || 'Open AI Examiner',
        url: f.buttonUrl || `${SITE}/documents`,
      },
      signoff: 'Happy studying,',
    };
    const preheader = (f.body || '')
      .replace(/^Hi[^\n]*\n+/i, '')
      .split(/\n/)[0]
      .slice(0, 140);
    return this.campaigns.render(
      {
        id: `follow-up-${f.id}`,
        templateKey: 'letter',
        subject: f.subject || content.headline,
        preheader,
        content,
      },
      person,
      {
        track: false,
        // The button counts clicks for this follow-up (never in a test email).
        trackLink: opts.trackClicks
          ? (url, label) =>
              this.links.trackedUrl(`fu:${f.id}`, person.userId, url, label)
          : undefined,
      },
    );
  }

  private async sentToday() {
    return this.campaigns.usedToday();
  }

  async send(id: string, by: string | null, opts: { auto?: boolean } = {}) {
    const f = await this.find(id);
    if (
      !['suggested', 'snoozed', 'failed'].includes(f.status) ||
      !f.body ||
      !f.subject
    )
      throw new HttpException(
        'This follow-up isn’t ready to send',
        HttpStatus.BAD_REQUEST,
      );
    const [p] = await select<{ email: string; first_name: string }>(
      `SELECT u.email, u.first_name FROM user u WHERE u.id = :id AND ${REAL_EMAIL_SQL}`,
      { id: f.userId },
    );
    if (!p)
      throw new HttpException(
        'This student has no email address',
        HttpStatus.BAD_REQUEST,
      );
    const [pref] = await select<{ marketing_opt_out: number; bounced: number }>(
      `SELECT marketing_opt_out, bounced FROM email_preference WHERE user_id = :id`,
      { id: f.userId },
    );
    if (pref && (Number(pref.marketing_opt_out) || Number(pref.bounced)))
      throw new HttpException(
        Number(pref.bounced)
          ? 'Emails to this address bounce'
          : 'This student has unsubscribed from emails',
        HttpStatus.BAD_REQUEST,
      );
    if ((await this.sentToday()) >= this.campaigns.dailyLimit)
      throw new HttpException(
        'Today’s email limit is used up. Try again tomorrow.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const firstName = (p.first_name || '').trim().split(/\s+/)[0] || null;
    const { html, text, headers } = await this.render(
      f,
      { userId: f.userId, firstName },
      { trackClicks: true },
    );
    try {
      await this.mailer.sendMarketingEmail({
        to: p.email,
        subject: f.subject,
        html,
        text,
        headers,
      });
    } catch (error) {
      const outcome = classifySendError(error);
      await f.update({
        status: outcome === 'retry' ? f.status : 'failed',
        error: String(
          error?.response || error?.message || 'Mail server error',
        ).slice(0, 290),
        updatedOn: new Date(),
      });
      throw new HttpException(
        outcome === 'retry'
          ? 'The mail server is busy. Try again in a minute.'
          : 'The email couldn’t be sent',
        HttpStatus.BAD_GATEWAY,
      );
    }
    await f.update({
      status: 'sent',
      sentOn: new Date(),
      sentBy: by,
      auto: !!opts.auto,
      error: null,
      updatedOn: new Date(),
    });
    return this.dto(f, await this.studentOf([f.userId]));
  }

  /** Sends the draft to the admin, exactly as the student would get it. */
  async sendTest(
    id: string,
    admin: { email: string | null; userId: string | null },
  ) {
    const f = await this.find(id);
    if (!admin.email)
      throw new HttpException(
        'No email address to send to',
        HttpStatus.BAD_REQUEST,
      );
    const [p] = await select<{ first_name: string }>(
      `SELECT first_name FROM user WHERE id = :id`,
      { id: f.userId },
    );
    const firstName = (p?.first_name || '').trim().split(/\s+/)[0] || null;
    // The unsubscribe link in a test points at the admin's own settings, never the student's.
    const { html, text } = await this.render(f, {
      userId: admin.userId ?? f.userId,
      firstName,
    });
    await this.mailer.sendMarketingEmail({
      to: admin.email,
      subject: `[Test] ${f.subject}`,
      html,
      text,
      headers: {},
    });
    return { sentTo: admin.email };
  }

  /** Sends ready drafts for rules set to send automatically, within the daily limit. */
  async autoSendReady() {
    const auto = (await this.ruleSettings())
      .filter((r) => r.enabled && r.autoSend)
      .map((r) => r.key);
    if (!auto.length) return 0;
    const ready = await FollowUpModel.findAll({
      where: {
        status: 'suggested',
        rule: auto,
        createdOn: { [Op.gte]: new Date(Date.now() - 2 * DAY) },
      },
      order: [['createdOn', 'ASC']],
      limit: 50,
    });
    let sent = 0;
    for (const f of ready) {
      try {
        await this.send(f.id, 'automatic', { auto: true });
        sent++;
      } catch {
        // Unsubscribed, no room today, or a mail error: it stays in the list for a person to see.
      }
    }
    return sent;
  }

  async edit(
    id: string,
    body: {
      subject?: unknown;
      headline?: unknown;
      body?: unknown;
      buttonLabel?: unknown;
    },
  ) {
    const f = await this.find(id);
    if (f.status === 'sent')
      throw new HttpException(
        'This email has been sent',
        HttpStatus.BAD_REQUEST,
      );
    const s = (v: unknown, max: number) =>
      typeof v === 'string' ? v.slice(0, max) : undefined;
    await f.update({
      ...(s(body.subject, 190) !== undefined
        ? { subject: s(body.subject, 190) }
        : {}),
      ...(s(body.headline, 190) !== undefined
        ? { headline: s(body.headline, 190) }
        : {}),
      ...(s(body.body, 5000) !== undefined ? { body: s(body.body, 5000) } : {}),
      ...(s(body.buttonLabel, 60) !== undefined
        ? { buttonLabel: s(body.buttonLabel, 60) }
        : {}),
      updatedOn: new Date(),
    });
    return this.dto(f, await this.studentOf([f.userId]));
  }

  async setStatus(
    id: string,
    action: 'snooze' | 'dismiss' | 'restore',
    days = 3,
  ) {
    const f = await this.find(id);
    if (f.status === 'sent')
      throw new HttpException(
        'This email has been sent',
        HttpStatus.BAD_REQUEST,
      );
    if (action === 'snooze')
      await f.update({
        status: 'snoozed',
        snoozedUntil: new Date(
          Date.now() + Math.min(30, Math.max(1, days)) * DAY,
        ),
        updatedOn: new Date(),
      });
    if (action === 'dismiss')
      await f.update({ status: 'dismissed', updatedOn: new Date() });
    if (action === 'restore')
      await f.update({
        status: f.body ? 'suggested' : 'failed',
        snoozedUntil: null,
        updatedOn: new Date(),
      });
    return this.dto(f, await this.studentOf([f.userId]));
  }

  async wakeSnoozed() {
    await FollowUpModel.update(
      { status: 'suggested', snoozedUntil: null, updatedOn: new Date() },
      { where: { status: 'snoozed', snoozedUntil: { [Op.lte]: new Date() } } },
    );
  }

  /** Marks sent follow-ups whose student has used the app since (within 14 days). */
  async trackReturns() {
    const open = await FollowUpModel.findAll({
      where: {
        status: 'sent',
        returnedOn: null,
        sentOn: { [Op.gte]: new Date(Date.now() - 14 * DAY) },
      },
    });
    if (!open.length) return 0;
    const earliest = new Date(
      Math.min(...open.map((f) => new Date(f.sentOn!).getTime())),
    );
    const rows = await select<{ user_id: string; at: Date }>(
      `SELECT x.user_id, x.at FROM (${USAGE_ROWS_SQL}) x WHERE x.user_id IN (:ids) ORDER BY x.at`,
      {
        aFrom: earliest,
        aTo: new Date(),
        aFromDay: watDay(earliest),
        aToDay: watDay(),
        ids: open.map((f) => f.userId),
      },
    );
    let marked = 0;
    for (const f of open) {
      const back = rows.find(
        (r) =>
          r.user_id === f.userId &&
          new Date(iso(r.at)!).getTime() >
            new Date(f.sentOn!).getTime() + 60_000,
      );
      if (back) {
        marked++;
        await f.update({ returnedOn: new Date(iso(back.at)!) });
      }
    }
    return marked;
  }

  /* ---------- Reading ---------- */

  private async studentOf(ids: string[]) {
    const rows = ids.length
      ? await select<{
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          role: string;
        }>(
          `SELECT id, first_name, last_name, email, role FROM user WHERE id IN (:ids)`,
          { ids: [...new Set(ids)] },
        )
      : [];
    return new Map(rows.map((r) => [r.id, r]));
  }

  private dto(
    f: FollowUpModel,
    people: Map<string, any>,
    clicked?: Map<string, string>,
  ) {
    const p = people.get(f.userId);
    const name = fullName(p?.first_name, p?.last_name, p?.role);
    const rule = ruleOf(f.rule);
    return {
      id: f.id,
      rule: f.rule,
      ruleTitle: rule?.title ?? f.rule,
      status: f.status,
      reason: f.reason,
      evidence: JSON.parse(f.evidence || '{}'),
      student: {
        id: f.userId,
        name,
        initials: name
          .split(/\s+/)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() ?? '')
          .join(''),
        email: p?.email ?? null,
      },
      subject: f.subject,
      headline: f.headline,
      body: f.body,
      buttonLabel: f.buttonLabel,
      buttonUrl: f.buttonUrl,
      auto: f.auto,
      createdOn: iso(f.createdOn),
      sentOn: iso(f.sentOn),
      sentBy: f.sentBy,
      returnedOn: iso(f.returnedOn),
      clickedOn: clicked?.get(f.id) ?? null,
      snoozedUntil: iso(f.snoozedUntil),
      error: f.error,
    };
  }

  async list(status?: string) {
    await this.wakeSnoozed();
    const statuses: Record<string, string[]> = {
      suggested: ['suggested', 'drafting', 'failed'],
      sent: ['sent'],
      snoozed: ['snoozed'],
      dismissed: ['dismissed'],
    };
    const which = statuses[status ?? 'suggested'] ?? statuses.suggested;
    const [rows, counts, rules, outcomes, sentToday] = await Promise.all([
      FollowUpModel.findAll({
        where: { status: which },
        order: which.includes('sent')
          ? [['sentOn', 'DESC']]
          : [['createdOn', 'DESC']],
        limit: 200,
      }),
      select<{ status: string; n: number }>(
        `SELECT status, COUNT(*) AS n FROM follow_up GROUP BY status`,
      ),
      this.ruleSettings(),
      this.outcomes(),
      this.sentToday(),
    ]);
    const [people, clicked] = await Promise.all([
      this.studentOf(rows.map((r) => r.userId)),
      this.clicks(rows.filter((r) => r.status === 'sent').map((r) => r.id)),
    ]);
    const count = (s: string[]) =>
      counts
        .filter((c) => s.includes(c.status))
        .reduce((a, c) => a + Number(c.n), 0);
    return {
      counts: {
        suggested: count(statuses.suggested),
        drafting: count(['drafting']),
        sent: count(statuses.sent),
        snoozed: count(statuses.snoozed),
        dismissed: count(statuses.dismissed),
      },
      busy: this.drafting,
      dailyLimit: this.campaigns.dailyLimit,
      sentToday,
      rules: rules.map((r) => ({
        ...r,
        ...(outcomes.find((o) => o.rule === r.key) ?? {
          sent: 0,
          returned: 0,
          clicked: 0,
        }),
      })),
      items: rows.map((f) => this.dto(f, people, clicked)),
    };
  }

  /** One student's follow-ups, newest first (for their page). */
  async forStudent(userId: string) {
    const rows = await FollowUpModel.findAll({
      where: { userId },
      order: [['createdOn', 'DESC']],
      limit: 20,
    });
    const [people, clicked] = await Promise.all([
      this.studentOf([userId]),
      this.clicks(rows.map((r) => r.id)),
    ]);
    return rows.map((f) => this.dto(f, people, clicked));
  }

  /** Per rule: emails sent, and how many of those students came back within 7 days. */
  async outcomes() {
    const [rows, clicks] = await Promise.all([
      select<{ rule: string; sent: number; returned: number }>(
        `SELECT rule, COUNT(*) AS sent,
                SUM(returned_on IS NOT NULL AND returned_on <= DATE_ADD(sent_on, INTERVAL 7 DAY)) AS returned
         FROM follow_up WHERE status = 'sent' GROUP BY rule`,
      ),
      this.clickedRules(),
    ]);
    return rows.map((r) => ({
      rule: r.rule,
      sent: num(r.sent),
      returned: num(r.returned),
      clicked: clicks.get(r.rule) ?? 0,
    }));
  }

  /** Follow-ups whose button was clicked, and when (from the click events). */
  async clicks(ids: string[]) {
    const map = new Map<string, string>();
    if (!ids.length) return map;
    const rows = await select<{ id: string; at: Date }>(
      `SELECT JSON_UNQUOTE(JSON_EXTRACT(props, '$.followUpId')) AS id, MIN(at) AS at
       FROM app_event WHERE name = 'email_clicked' AND session_id = 'email'
       GROUP BY id HAVING id IN (:ids)`,
      { ids },
    );
    for (const r of rows) map.set(r.id, iso(r.at)!);
    return map;
  }

  private async clickedRules() {
    const rows = await select<{ rule: string; n: number }>(
      `SELECT f.rule, COUNT(DISTINCT f.id) AS n FROM follow_up f
       JOIN app_event e ON e.name = 'email_clicked' AND e.session_id = 'email'
         AND JSON_UNQUOTE(JSON_EXTRACT(e.props, '$.followUpId')) = f.id
       WHERE f.status = 'sent' GROUP BY f.rule`,
    );
    return new Map(rows.map((r) => [r.rule, num(r.n)]));
  }

  /** Today's sends so far (WAT). */
  static todayStart() {
    return startOfWatDay();
  }
}
