import { Inject, Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { parseRange } from '../range';
import { AdminAnalyticsService } from '../services/AdminAnalyticsService';
import { AdminStatsService } from '../services/AdminStatsService';
import { watDay } from '../time';
import { FALLBACK_BETA, claude } from './claude';
import { FollowUpService } from './FollowUpService';
import { IdeasService } from './IdeasService';
import { TelemetryService } from '../telemetry/TelemetryService';
import { InsightsService } from './InsightsService';
import { INSIGHTS_MODEL } from './prompts';

const MAX_TURNS = 8;

export type AskEvent =
  | { type: 'step'; label: string }
  | {
      type: 'card';
      card: { kind: 'email'; followUp: unknown; unsubscribed?: boolean };
    }
  | { type: 'text'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

const SYSTEM = (
  today: string,
) => `You are the analyst inside AI Examiner's admin dashboard, talking to the founder. AI Examiner is a study app used mostly by university students in Nigeria; they upload lecture notes, make practice tests, chat with their documents and read them in Easy Read. Today is ${today} (Lagos time).

Use the tools to look things up before answering. Never make up a number, a name or a quote: if the tools don't have it, say so. Labels (moods, issues, summaries) come from Claude reading conversations and tests overnight; treat them as good estimates, not facts.

How to answer:
- Lead with the answer in one or two sentences, then the evidence, then a suggested next step when it helps.
- Use short paragraphs or bullet points. Stay under about 250 words unless asked for more.
- Link people and things so the founder can open them: students as [Name](/admin/users/ID), conversations as [what it was about](/admin/conversations/KEY), tests as [the test](/admin/tests/KEY), documents as [Title](/admin/documents/ID), follow-ups as [Follow-ups](/admin/follow-ups).
- Dates in plain words ("last Tuesday", "12 Nov"). British English.
- Refer to a student by name or as "they"; a name doesn't tell you someone's gender.

You can act, carefully:
- When the founder asks you to email, follow up with, thank or check on a student, find them first, read their profile, then use draft_email with a specific purpose (what happened, what you want the email to do). The draft appears in the chat as a card with buttons to view it, send a test and send it. You never send anything yourself and must not say you did; only the founder can, from the card.
- When you recommend existing follow-ups, show the best one to three with show_email so the founder can act on them right there.
- For product questions ("what should we build", "why do students leave"), read product_ideas and the numbers.
- Be proactive: when it helps, end with one or two concrete next steps the founder can take, and offer to draft the emails.`;

const tool = (
  name: string,
  description: string,
  properties: Record<string, unknown>,
) => ({
  name,
  description,
  strict: true,
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  },
});

const RANGE = {
  from: {
    type: 'string',
    description: 'First day, YYYY-MM-DD (Lagos). Empty for 30 days ago.',
  },
  to: { type: 'string', description: 'Last day, YYYY-MM-DD. Empty for today.' },
};

const TOOLS = [
  tool(
    'overview_numbers',
    'Headline numbers for a date range compared with the period before: active students, sign-ups, tests made and finished, uploads, Easy Read time, revenue, and the sign-up funnel.',
    RANGE,
  ),
  tool(
    'feedback_summary',
    'What Claude’s labels say for a date range: moods, the most common problems and what students wanted, for chats and tests; fields, subjects and kinds of uploaded documents; students’ own thumbs up/down.',
    RANGE,
  ),
  tool(
    'find_labelled_items',
    'Individual labelled chats, tests or documents, newest first, with Claude’s summary, the student’s quote, the student and a link key.',
    {
      kind: { type: 'string', enum: ['chat', 'test', 'document'] },
      mood: {
        type: 'string',
        enum: ['', 'satisfied', 'neutral', 'frustrated', 'unclear'],
        description: 'Empty for any.',
      },
      issue: {
        type: 'string',
        description:
          'An issue tag such as wrong_or_made_up, too_hard, had_to_repeat. Empty for any.',
      },
      ...RANGE,
      limit: { type: 'integer', description: 'How many, 1 to 25.' },
    },
  ),
  tool(
    'test_dropoff',
    'How tests went in a date range: made, started and finished by type, where unfinished tests stop, stop reasons, topics students miss, and flagged questions.',
    RANGE,
  ),
  tool(
    'follow_up_list',
    'The follow-up list: suggested emails waiting for review (or sent, snoozed, dismissed), with each student, the rule and why; plus how many came back after past emails.',
    {
      status: {
        type: 'string',
        enum: ['suggested', 'sent', 'snoozed', 'dismissed'],
      },
    },
  ),
  tool(
    'find_students',
    'Search students by name or email. Returns plan, last active, documents and tests.',
    {
      query: { type: 'string' },
    },
  ),
  tool(
    'draft_email',
    'Write a personal email to one student as a draft for the founder to review. Nothing is sent: the draft appears in the chat as a card with buttons to view, test and send it. Look the student up first. Put the specifics in purpose: what happened, what the email should say or ask, and the one thing they should do next.',
    {
      user_id: { type: 'string', description: 'The student’s id.' },
      purpose: {
        type: 'string',
        description: 'What the email is for, specifically.',
      },
    },
  ),
  tool(
    'show_email',
    'Show one existing follow-up email (from follow_up_list) as a card the founder can view, test and send.',
    {
      follow_up_id: { type: 'string' },
    },
  ),
  tool(
    'where_students_get_stuck',
    'What students do in the app, from live tracking (only since tracking started; check since): how many open the upload page, start and finish uploads, make, open and finish tests; how long uploads, test generation and chat replies take (median and slowest 10%); failures, limits hit, tests left part-way, errors shown, and the pages where visits end.',
    RANGE,
  ),
  tool(
    'student_timeline',
    'One student’s recent visits from live tracking, event by event: pages, uploads, tests opened and left, chat waits, limits and errors. Use it to see exactly where someone got stuck.',
    {
      user_id: { type: 'string' },
    },
  ),
  tool(
    'product_ideas',
    'Claude’s current product ideas (new and planned): what to build or change to solve what students run into, with evidence, impact and effort.',
    {},
  ),
  tool(
    'student_profile',
    'One student in depth: plan, usage, recent activity and Claude’s labels on their chats and tests.',
    {
      user_id: { type: 'string' },
    },
  ),
];

const STEP_LABEL: Record<string, string> = {
  overview_numbers: 'Checking the headline numbers',
  feedback_summary: 'Reading the feedback labels',
  find_labelled_items: 'Looking through labelled items',
  test_dropoff: 'Looking at how tests went',
  follow_up_list: 'Opening the follow-up list',
  find_students: 'Searching students',
  student_profile: 'Reading a student’s history',
  draft_email: 'Writing the email',
  show_email: 'Opening the email',
  product_ideas: 'Reading the product ideas',
  where_students_get_stuck: 'Checking where students get stuck',
  student_timeline: 'Following a student’s visits',
};

const compactLabel = (l: any) =>
  l && {
    mood: l.mood,
    issues: l.issues,
    summary: l.summary,
    quote: l.quote,
    outcome: l.outcome,
    details: l.details,
  };

/** "Ask Claude": answers questions about students with read-only tools, streamed. */
@Injectable()
export class AskService {
  constructor(
    @Inject(AdminAnalyticsService) private analytics: AdminAnalyticsService,
    @Inject(AdminStatsService) private stats: AdminStatsService,
    @Inject(InsightsService) private insights: InsightsService,
    @Inject(FollowUpService) private followUps: FollowUpService,
    @Inject(IdeasService) private ideas: IdeasService,
    @Inject(TelemetryService) private telemetry: TelemetryService,
  ) {}

  private async runTool(
    name: string,
    input: any,
    ctx: { emit: (e: AskEvent) => void; adminEmail: string | null },
  ): Promise<unknown> {
    const range = () => {
      const r = parseRange(
        input?.from || undefined,
        input?.to || undefined,
        new Date(),
        30,
      );
      return { from: r.from, to: r.to };
    };
    switch (name) {
      case 'overview_numbers': {
        const a: any = await this.analytics.analytics({ ...range() });
        const m = (k: string) => ({
          total: Math.round(a.metrics[k].total),
          previous: Math.round(a.metrics[k].previous),
        });
        return {
          range: a.range,
          previous: a.previous,
          activeStudents: m('active'),
          signUps: m('signUps'),
          testsMade: m('testsMade'),
          testsFinished: m('testsFinished'),
          uploads: m('uploads'),
          chatQuestions: m('chats'),
          easyReadMinutes: {
            total: Math.round(a.metrics.reading.total / 60),
            previous: Math.round(a.metrics.reading.previous / 60),
          },
          revenueNaira: m('revenue'),
          revenueUsd: m('revenueUsd'),
          payments: m('payments'),
          funnel: a.funnel,
          averageScore: a.extras.averageScore,
          averageDailyActive: a.extras.averageDailyActive,
        };
      }
      case 'feedback_summary':
        return this.insights.overview(range());
      case 'find_labelled_items': {
        const res = await this.insights.labels({
          kind: input.kind,
          mood: input.mood || undefined,
          issue: input.issue || undefined,
          ...range(),
          pageSize: Math.min(25, Math.max(1, Number(input.limit) || 10)),
        });
        return {
          total: res.total,
          items: res.items.map((i: any) => ({
            kind: i.kind,
            key: i.key,
            on: i.occurredOn?.slice(0, 10),
            student: { id: i.student.userId, name: i.student.name },
            document: i.documentTitle
              ? { id: i.documentId, title: i.documentTitle }
              : null,
            label: compactLabel(i.label),
          })),
        };
      }
      case 'test_dropoff':
        return this.insights.testsSummary(range());
      case 'follow_up_list': {
        const res: any = await this.followUps.list(input.status);
        return {
          counts: res.counts,
          rules: res.rules.map((r: any) => ({
            rule: r.key,
            title: r.title,
            enabled: r.enabled,
            autoSend: r.autoSend,
            sent: r.sent,
            cameBack: r.returned,
          })),
          items: res.items.slice(0, 40).map((f: any) => ({
            id: f.id,
            student: { id: f.student.id, name: f.student.name },
            rule: f.ruleTitle,
            status: f.status,
            reason: f.reason,
            subject: f.subject,
            created: f.createdOn?.slice(0, 10),
            sent: f.sentOn?.slice(0, 10) ?? null,
            cameBack: f.returnedOn?.slice(0, 10) ?? null,
          })),
        };
      }
      case 'find_students': {
        const res: any = await this.stats.users({
          search: String(input.query || ''),
          pageSize: 10,
        });
        return res.users.map((u: any) => ({
          id: u.id,
          name: u.name,
          plan: u.plan,
          lastActive: u.lastSeenAt?.slice(0, 10) ?? null,
          signedUp: u.createdOn?.slice(0, 10) ?? null,
          documents: u.documents,
          testsMade: u.tests,
          testsFinished: u.testsFinished,
          averageScore: u.averageScore,
          easyReadMinutes: Math.round((u.readingSeconds ?? 0) / 60),
        }));
      }
      case 'student_profile': {
        const id = String(input.user_id || '');
        const [detail, labels]: any[] = await Promise.all([
          this.stats.userDetail(id),
          this.insights.labels({
            userId: id,
            from: '2024-05-01',
            pageSize: 20,
          }),
        ]);
        return {
          user: detail.user,
          stats: detail.stats,
          easyRead: detail.easyRead,
          recent: detail.days.slice(0, 6).map((d: any) => ({
            day: d.date,
            did: d.items.slice(0, 8).map((i: any) => i.detail),
          })),
          labels: labels.items.map((i: any) => ({
            kind: i.kind,
            key: i.key,
            on: i.occurredOn?.slice(0, 10),
            label: compactLabel(i.label),
          })),
        };
      }
      case 'draft_email': {
        const f: any = await this.followUps.createManual(
          String(input.user_id || ''),
          String(input.purpose || ''),
          ctx.adminEmail,
        );
        ctx.emit({
          type: 'card',
          card: { kind: 'email', followUp: f, unsubscribed: f.unsubscribed },
        });
        return {
          followUpId: f.id,
          status: f.status,
          to: f.student.name,
          subject: f.subject,
          body: f.body,
          unsubscribed: f.unsubscribed,
          note: f.unsubscribed
            ? 'This student has unsubscribed from emails or their address bounced, so it can’t be sent.'
            : 'Shown to the founder as a card to review. Not sent.',
        };
      }
      case 'show_email': {
        const f: any = await this.followUps.get(
          String(input.follow_up_id || ''),
        );
        ctx.emit({ type: 'card', card: { kind: 'email', followUp: f } });
        return {
          shown: true,
          to: f.student.name,
          subject: f.subject,
          status: f.status,
        };
      }
      case 'where_students_get_stuck':
        return this.telemetry.report(range());
      case 'student_timeline': {
        const sessions = await this.telemetry.timeline(
          String(input.user_id || ''),
          200,
        );
        return sessions.slice(0, 12).map((s: any) => ({
          start: s.start,
          end: s.end,
          events: s.events.map((e: any) =>
            [e.at.slice(11, 19), e.name, e.path, e.ms, e.props].filter(
              (x) => x !== null && x !== undefined,
            ),
          ),
        }));
      }
      case 'product_ideas': {
        const [fresh, planned]: any[] = await Promise.all([
          this.ideas.list('new'),
          this.ideas.list('planned'),
        ]);
        const brief = (i: any) => ({
          title: i.title,
          area: i.area,
          problem: i.problem,
          proposal: i.proposal,
          impact: i.impact,
          effort: i.effort,
          studentsAffected: i.studentsAffected,
          evidence: i.evidence,
        });
        return {
          writtenOn: fresh.generatedOn,
          new: fresh.items.map(brief),
          planned: planned.items.map(brief),
          link: '/admin/ideas',
        };
      }
      default:
        return { error: `Unknown tool ${name}` };
    }
  }

  /** Streams an answer, looking things up with the tools as needed. */
  async ask(
    question: string,
    history: { role: 'user' | 'assistant'; text: string }[],
    emit: (e: AskEvent) => void,
    signal: AbortSignal,
    adminEmail: string | null = null,
  ) {
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      ...history
        .slice(-6)
        .map((h) => ({ role: h.role, content: h.text.slice(0, 4000) })),
      { role: 'user', content: question.slice(0, 2000) },
    ];
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      if (signal.aborted) return;
      const stream = claude().beta.messages.stream(
        {
          model: INSIGHTS_MODEL,
          max_tokens: 16000,
          betas: [FALLBACK_BETA],
          fallbacks: 'default',
          system: [
            {
              type: 'text',
              text: SYSTEM(watDay()),
              cache_control: { type: 'ephemeral' },
            },
          ],
          tools: TOOLS as any,
          messages,
          output_config: { effort: 'medium' },
        } as any,
        { signal },
      );
      stream.on('text', (delta: string) => emit({ type: 'text', text: delta }));
      const message = await stream.finalMessage();
      if (message.stop_reason === 'refusal') {
        emit({
          type: 'error',
          message: 'Claude couldn’t answer that one. Try asking another way.',
        });
        return;
      }
      const uses = message.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use',
      );
      if (message.stop_reason !== 'tool_use' || !uses.length) {
        emit({ type: 'done' });
        return;
      }
      messages.push({ role: 'assistant', content: message.content as any });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const use of uses) {
        emit({
          type: 'step',
          label: STEP_LABEL[use.name] ?? 'Looking something up',
        });
        try {
          const out = await this.runTool(use.name, use.input, {
            emit,
            adminEmail,
          });
          results.push({
            type: 'tool_result',
            tool_use_id: use.id,
            content: JSON.stringify(out).slice(0, 60000),
          });
        } catch (error) {
          results.push({
            type: 'tool_result',
            tool_use_id: use.id,
            is_error: true,
            content: String(error?.message ?? 'That lookup failed'),
          });
        }
      }
      messages.push({ role: 'user', content: results });
    }
    emit({ type: 'done' });
  }
}
