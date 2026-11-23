import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  OnModuleInit,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { generateUUID } from 'src/utils';
import { AdminGuard } from '../AdminGuard';
import { parseRange } from '../range';
import { iso, select } from '../sql';
import { addDays, watDay } from '../time';
import { AdminAnalyticsService } from '../services/AdminAnalyticsService';
import { TelemetryService } from '../telemetry/TelemetryService';
import { FALLBACK_BETA, claude, jsonOf } from './claude';
import { InsightsJobs } from './InsightsJobs';
import { InsightsService } from './InsightsService';
import { AiDigestModel, AiIdeaModel } from './models';
import { IDEAS_SCHEMA, IDEAS_SYSTEM, INSIGHTS_MODEL } from './prompts';

const STATUSES = ['new', 'planned', 'done', 'dismissed'];
const parse = (v: string | null) => {
  try {
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
};
const clip = (v: unknown, n: number) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n);

/**
 * Product ideas: Claude reads the last 90 days (labels, fix ideas, quotes, the funnel, who comes
 * back, test drop-off) and suggests what to build. Weekly on Mondays, or when asked.
 */
@Injectable()
export class IdeasService implements OnModuleInit {
  private job: Promise<unknown> | null = null;
  private lastError: string | null = null;

  constructor(
    @Inject(InsightsJobs) private jobs: InsightsJobs,
    @Inject(InsightsService) private insights: InsightsService,
    @Inject(AdminAnalyticsService) private analytics: AdminAnalyticsService,
    @Inject(TelemetryService) private telemetry: TelemetryService,
  ) {}

  onModuleInit() {
    this.jobs.schedule({
      name: 'weekly_ideas',
      hour: 8,
      mondays: true,
      run: async () => {
        await this.generate();
      },
    });
  }

  async list(status?: string) {
    const which = STATUSES.includes(status ?? '') ? status! : 'new';
    const [rows, counts, last] = await Promise.all([
      AiIdeaModel.findAll({
        where: { status: which },
        order: [['createdOn', 'DESC']],
        limit: 100,
      }),
      select<{ status: string; n: number }>(
        `SELECT status, COUNT(*) AS n FROM ai_idea GROUP BY status`,
      ),
      select<{ at: Date }>(`SELECT MAX(created_on) AS at FROM ai_idea`),
    ]);
    const rank = { high: 0, medium: 1, low: 2 } as Record<string, number>;
    const effort = { small: 0, medium: 1, large: 2 } as Record<string, number>;
    const items = rows
      .map((r) => this.dto(r))
      .sort((a, b) =>
        which === 'new'
          ? rank[a.impact] - rank[b.impact] ||
            effort[a.effort] - effort[b.effort]
          : 0,
      );
    return {
      running: !!this.job,
      error: this.lastError,
      generatedOn: iso(last[0]?.at),
      counts: Object.fromEntries(
        STATUSES.map((s) => [
          s,
          Number(counts.find((c) => c.status === s)?.n ?? 0),
        ]),
      ),
      items,
    };
  }

  /** Starts a run in the background (one at a time). */
  start() {
    if (!this.job) {
      this.lastError = null;
      this.job = this.generate()
        .catch((e) => {
          this.lastError =
            e?.message ?? 'Claude couldn’t write ideas this time.';
          console.error('ideas failed', e?.message);
        })
        .finally(() => (this.job = null));
    }
    return this.list();
  }

  async setStatus(
    id: string,
    body: { status?: string; note?: string },
    adminEmail: string | null,
  ) {
    const idea = await AiIdeaModel.findByPk(id);
    if (!idea) throw new HttpException('Idea not found', HttpStatus.NOT_FOUND);
    const patch: Partial<AiIdeaModel> = {
      updatedOn: new Date(),
      statusBy: adminEmail,
    };
    if (body.status && STATUSES.includes(body.status))
      patch.status = body.status;
    if (typeof body.note === 'string')
      patch.note = body.note.trim().slice(0, 2000) || null;
    await idea.update(patch);
    return this.dto(idea);
  }

  private dto(r: AiIdeaModel) {
    return {
      id: r.id,
      title: r.title,
      area: r.area,
      problem: r.problem,
      proposal: r.proposal,
      firstStep: r.firstStep,
      impact: r.impact as 'high' | 'medium' | 'low',
      effort: r.effort as 'small' | 'medium' | 'large',
      studentsAffected: r.studentsAffected,
      evidence: (parse(r.evidence) ?? []) as string[],
      examples: (parse(r.examples) ?? []) as {
        kind: 'chat' | 'test';
        key: string;
        quote: string;
        summary: string;
      }[],
      status: r.status,
      note: r.note,
      statusBy: r.statusBy,
      createdOn: iso(r.createdOn),
      updatedOn: iso(r.updatedOn),
    };
  }

  /** Everything Claude reads: numbers, fix ideas and quotes from the last 90 days. */
  private async gather() {
    const to = watDay();
    const from = addDays(to, -89);
    const range = parseRange(from, to);
    const [behaviour, overview, tests, numbers, labels, digest, past] =
      await Promise.all([
        this.telemetry
          .report({ from: addDays(to, -29), to })
          .catch(() => null) as Promise<any>,
        this.insights.overview({ from, to }) as Promise<any>,
        this.insights.testsSummary({ from, to }) as Promise<any>,
        this.analytics.analytics({ from, to }) as Promise<any>,
        select<any>(
          `SELECT kind, item_key, COALESCE(corrected_mood, mood) AS mood, issues, summary, quote, fix_idea
         FROM ai_label
         WHERE status = 'done' AND kind IN ('chat', 'test') AND occurred_on >= :start AND occurred_on < :end
           AND fix_idea IS NOT NULL AND fix_idea <> ''
         ORDER BY (COALESCE(corrected_mood, mood) = 'frustrated') DESC, occurred_on DESC
         LIMIT 240`,
          { start: range.start, end: range.end },
        ),
        AiDigestModel.findOne({ order: [['createdOn', 'DESC']] }),
        AiIdeaModel.findAll({
          where: { status: ['planned', 'done', 'dismissed'] },
          order: [['updatedOn', 'DESC']],
          limit: 40,
        }),
      ]);

    const examples = new Map<
      string,
      { kind: string; key: string; quote: string; summary: string }
    >();
    const lines = labels.map((l, i) => {
      const id = `${l.kind === 'chat' ? 'c' : 't'}${i + 1}`;
      examples.set(id, {
        kind: l.kind,
        key: l.item_key,
        quote: clip(l.quote, 240),
        summary: clip(l.summary, 240),
      });
      const issues = (parse(l.issues) ?? []).join(',');
      return `${id} [${l.kind}, ${l.mood}${issues ? `, ${issues}` : ''}] ${clip(l.summary, 200)}${
        l.quote ? ` | student: "${clip(l.quote, 160)}"` : ''
      } | fix: ${clip(l.fix_idea, 200)}`;
    });

    const cohorts = (numbers?.cohorts ?? []).slice(-10).map((c: any) => ({
      week: c.week,
      signedUp: c.size,
      backInWeek1: c.weeks?.[1] ?? null,
      backInWeek2: c.weeks?.[2] ?? null,
      backInWeek4: c.weeks?.[4] ?? null,
    }));
    const facts = {
      range: { from, to },
      funnel: numbers?.funnel,
      returnRatesBySignUpWeek: cohorts,
      featureUse: numbers?.features,
      easyRead: numbers?.easyRead && {
        readers: numbers.easyRead.readers,
        sessions: numbers.easyRead.sessions,
      },
      chat: overview?.chat && {
        labelled: overview.chat.labelled,
        moods: overview.chat.moods,
        issues: overview.chat.issues,
        intents: overview.chat.intents,
        outcomes: overview.chat.outcomes,
      },
      tests: {
        byType: tests?.byType,
        attempts: tests?.attempts,
        whereUnfinishedTestsStop: tests?.stops,
        moods: tests?.moods,
        issues: tests?.issues,
        stopReasons: tests?.stopReasons,
        topicsMissed: tests?.struggles,
        questionsStudentsReported: tests?.flagged?.length ?? 0,
      },
      uploads: overview?.documents && {
        labelled: overview.documents.labelled,
        fields: overview.documents.fields,
        kinds: overview.documents.kinds,
        levels: overview.documents.levels,
        readable: overview.documents.quality,
      },
      studentRatings: overview?.feedback,
      // Live tracking of what students do in the app (only since tracking began).
      appBehaviourLast30Days: behaviour?.totals?.events
        ? {
            trackingSince: behaviour.since,
            steps: behaviour.steps,
            waitsInMs: behaviour.waits,
            failures: behaviour.failures,
            limitsHit: behaviour.limits,
            visitsEndOn: behaviour.exitPages,
          }
        : 'No live tracking yet.',
    };
    const themes = parse(digest?.content ?? null);
    const pastIdeas = past.map(
      (p) =>
        `- [${p.status}] ${p.title}${p.note ? ` (team note: ${clip(p.note, 160)})` : ''}`,
    );

    const prompt = [
      `Numbers for ${from} to ${to}:\n${JSON.stringify(facts)}`,
      themes
        ? `Last themes report: ${JSON.stringify({ headline: themes.headline, sections: themes.sections })}`
        : '',
      `Labelled chats and tests with Claude's fix idea (id [kind, mood, issues] summary | student quote | fix):\n${lines.join('\n')}`,
      pastIdeas.length
        ? `Ideas the team already has:\n${pastIdeas.join('\n')}`
        : 'The team has no ideas on file yet.',
    ]
      .filter(Boolean)
      .join('\n\n');
    return { prompt, examples };
  }

  async generate() {
    const { prompt, examples } = await this.gather();
    const stream = claude().beta.messages.stream({
      model: INSIGHTS_MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      system: [{ type: 'text', text: IDEAS_SYSTEM }],
      messages: [{ role: 'user', content: prompt }],
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: IDEAS_SCHEMA },
      },
    } as any);
    const message: any = await stream.finalMessage();
    const out =
      message.stop_reason === 'refusal'
        ? null
        : jsonOf<{ ideas: any[] }>(message.content);
    if (!out?.ideas?.length)
      throw new Error('Claude couldn’t write ideas this time. Try again.');

    const runId = generateUUID();
    const now = new Date();
    // The new run replaces earlier ideas nobody has acted on.
    await AiIdeaModel.update(
      { status: 'replaced', updatedOn: now },
      { where: { status: 'new' } },
    );
    await AiIdeaModel.bulkCreate(
      out.ideas.slice(0, 10).map((i) => ({
        id: generateUUID(),
        runId,
        title: clip(i.title, 200),
        area: clip(i.area, 20) || 'other',
        problem: String(i.problem ?? '').trim(),
        proposal: String(i.proposal ?? '').trim(),
        firstStep: String(i.first_step ?? '').trim(),
        impact: ['high', 'medium', 'low'].includes(i.impact)
          ? i.impact
          : 'medium',
        effort: ['small', 'medium', 'large'].includes(i.effort)
          ? i.effort
          : 'medium',
        studentsAffected: Math.max(
          0,
          Math.round(Number(i.students_affected) || 0),
        ),
        evidence: JSON.stringify(
          (i.evidence ?? []).map((e: unknown) => clip(e, 300)).slice(0, 5),
        ),
        examples: JSON.stringify(
          (i.example_ids ?? [])
            .map((id: string) => examples.get(String(id).trim()))
            .filter(Boolean)
            .slice(0, 3),
        ),
        status: 'new',
        model: clip(message.model ?? INSIGHTS_MODEL, 40),
        createdOn: now,
        updatedOn: now,
      })) as AiIdeaModel[],
    );
    return { created: out.ideas.length };
  }
}

const emailOf = (req: Request) =>
  (req['user'] as VerifiedTokenModel)?.email ?? null;

@UseGuards(AdminGuard)
@Controller('admin/ideas')
export class IdeasController {
  constructor(@Inject(IdeasService) private ideas: IdeasService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.ideas.list(status);
  }

  @Post('generate')
  generate() {
    return this.ideas.start();
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { status?: string; note?: string },
    @Req() req: Request,
  ) {
    return this.ideas.setStatus(id, body ?? {}, emailOf(req));
  }
}
