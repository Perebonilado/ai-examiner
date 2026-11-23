import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { generateUUID } from 'src/utils';
import { parseRange } from '../range';
import { iso, select } from '../sql';
import { addDays, watDay } from '../time';
import { FALLBACK_BETA, claude, jsonOf } from './claude';
import { InsightsJobs } from './InsightsJobs';
import { AiDigestModel } from './models';
import { DIGEST_SCHEMA, DIGEST_SYSTEM, INSIGHTS_MODEL } from './prompts';

/** Most items given to Claude for one report (spread evenly over the range when there are more). */
const MAX_ITEMS = 700;

const parse = (v: unknown) => {
  try {
    return typeof v === 'string' ? JSON.parse(v) : v;
  } catch {
    return null;
  }
};

/** Claude's themes for a date range: what students struggle with, want, and study. */
@Injectable()
export class DigestService implements OnModuleInit {
  private running = new Map<string, Promise<unknown>>();

  constructor(@Inject(InsightsJobs) private jobs: InsightsJobs) {}

  onModuleInit() {
    // Monday morning: last week's themes.
    this.jobs.schedule({
      name: 'weekly_digest',
      hour: 7,
      mondays: true,
      run: async () => {
        const to = addDays(watDay(), -1);
        await this.generate(addDays(to, -6), to);
      },
    });
  }

  private dto(
    d: AiDigestModel | null,
    latestLabelOn: string | null,
    wantedTo?: string,
  ) {
    if (!d) return null;
    const content = parse(d.content) ?? {};
    return {
      id: d.id,
      from: d.rangeFrom,
      to: d.rangeTo,
      labelCount: d.labelCount,
      createdOn: iso(d.createdOn),
      /** New labels have arrived since this report was written. */
      stale:
        (!!wantedTo && d.rangeTo !== wantedTo) ||
        (!!latestLabelOn && latestLabelOn > (iso(d.createdOn) ?? '')),
      headline: content.headline ?? '',
      sections: (content.sections ?? []).map((s: any) => ({
        kind: s.kind,
        themes: s.themes ?? [],
      })),
      brightSpots: content.bright_spots ?? [],
    };
  }

  async latest(q: { from?: string; to?: string }) {
    const range = parseRange(q.from, q.to, new Date(), 30);
    // The report for this range, or else the latest one from the same start (a range like
    // "this year" moves on every day; yesterday's report is still worth showing, marked stale).
    const [exact, last] = await Promise.all([
      AiDigestModel.findOne({
        where: { rangeFrom: range.from, rangeTo: range.to },
        order: [['createdOn', 'DESC']],
      }).then(
        (d) =>
          d ??
          AiDigestModel.findOne({
            where: { rangeFrom: range.from },
            order: [['createdOn', 'DESC']],
          }),
      ),
      select<{ at: Date }>(
        `SELECT MAX(labelled_on) AS at FROM ai_label WHERE status = 'done' AND occurred_on >= :start AND occurred_on < :end`,
        { start: range.start, end: range.end },
      ),
    ]);
    return {
      range: { from: range.from, to: range.to },
      running: this.running.has(`${range.from}|${range.to}`),
      digest: this.dto(exact, iso(last[0]?.at), range.to),
    };
  }

  /** Writes a fresh report for the range (one at a time per range). */
  generate(from?: string, to?: string) {
    const range = parseRange(from, to, new Date(), 30);
    const key = `${range.from}|${range.to}`;
    const existing = this.running.get(key);
    if (existing) return existing;
    const job = this.build(
      range.from,
      range.to,
      range.start,
      range.end,
    ).finally(() => this.running.delete(key));
    this.running.set(key, job);
    return job;
  }

  private async build(from: string, to: string, start: Date, end: Date) {
    const rows = await select<any>(
      `SELECT kind, COALESCE(corrected_mood, mood) AS mood, outcome, issues, summary, quote, details
       FROM ai_label WHERE status = 'done' AND occurred_on >= :start AND occurred_on < :end ORDER BY occurred_on`,
      { start, end },
    );
    if (!rows.length)
      return {
        created: false,
        reason: 'Nothing is labelled in this range yet.',
      };
    const step = rows.length > MAX_ITEMS ? rows.length / MAX_ITEMS : 1;
    const picked =
      rows.length > MAX_ITEMS
        ? Array.from(
            { length: MAX_ITEMS },
            (_, i) => rows[Math.floor(i * step)],
          )
        : rows;
    const lines = picked.map((r) => {
      const d = parse(r.details) ?? {};
      if (r.kind === 'document')
        return `[document] field=${d.field} subject="${d.subject}" kind=${d.kind} level=${d.level} quality=${d.quality} | ${r.summary ?? ''}`;
      const issues = (parse(r.issues) ?? []).join(',') || 'none';
      const extra =
        r.kind === 'test'
          ? ` type=${d.testType} status=${d.status}${d.score != null ? ` score=${d.score}` : ''}${d.stopReason && d.stopReason !== 'not_applicable' ? ` stop=${d.stopReason}` : ''}`
          : '';
      return `[${r.kind}] mood=${r.mood} outcome=${r.outcome} issues=${issues}${extra} | ${r.summary ?? ''}${r.quote ? ` | "${r.quote}"` : ''}`;
    });
    const counts = rows.reduce(
      (acc: Record<string, number>, r: any) => (
        (acc[r.kind] = (acc[r.kind] ?? 0) + 1), acc
      ),
      {},
    );
    const intro = `Date range: ${from} to ${to}. Labelled items in the range: ${Object.entries(
      counts,
    )
      .map(([k, n]) => `${n} ${k}`)
      .join(
        ', ',
      )}.${rows.length > MAX_ITEMS ? ` You see an even sample of ${MAX_ITEMS}; scale counts to the full numbers above.` : ''}`;
    const stream = claude().beta.messages.stream({
      model: INSIGHTS_MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      system: [{ type: 'text', text: DIGEST_SYSTEM }],
      messages: [{ role: 'user', content: `${intro}\n\n${lines.join('\n')}` }],
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: DIGEST_SCHEMA },
      },
    } as any);
    const message: any = await stream.finalMessage();
    const out =
      message.stop_reason === 'refusal' ? null : jsonOf<any>(message.content);
    if (!out)
      return {
        created: false,
        reason: 'Claude couldn’t write the report. Try again.',
      };
    await AiDigestModel.create({
      id: generateUUID(),
      rangeFrom: from,
      rangeTo: to,
      content: JSON.stringify(out),
      labelCount: rows.length,
      model: message.model ?? INSIGHTS_MODEL,
      createdOn: new Date(),
    } as AiDigestModel);
    return { created: true };
  }
}
