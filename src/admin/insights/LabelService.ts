import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { generateUUID } from 'src/utils';
import { run, select } from '../sql';
import { addDays, watDay, watDayStart } from '../time';
import { claude, jsonOf, tokensOf, TokenTotals } from './claude';
import {
  LabelItem,
  collectChats,
  collectDocuments,
  collectEssays,
  collectTests,
} from './items';
import { AiBatchModel, AiLabelModel, LABEL_KINDS, LabelKind } from './models';
import {
  BATCH_PRICE,
  CHAT_SCHEMA,
  CHAT_SYSTEM,
  DOCUMENT_SCHEMA,
  DOCUMENT_SYSTEM,
  INSIGHTS_MODEL,
  PROMPT_VERSION,
  TEST_SCHEMA,
  TEST_SYSTEM,
  costOf,
} from './prompts';

/** Requests per batch (the API allows far more; smaller batches finish and import sooner). */
const BATCH_SIZE = 1000;
/** A batch stuck "importing" this long (the server stopped mid-way) is picked up again. */
const IMPORT_STALE_MS = 30 * 60 * 1000;
/** The first day anything was recorded. */
export const FIRST_MONTH = '2024-05';

const PREFIX: Record<LabelKind, string> = {
  chat: 'c',
  test: 't',
  document: 'd',
};
const KIND_OF: Record<string, LabelKind> = {
  c: 'chat',
  t: 'test',
  e: 'test',
  d: 'document',
};

/** custom_id allows letters, digits, "_" and "-" (64 at most). */
export const customIdOf = (item: { kind: LabelKind; key: string }) =>
  item.key.startsWith('essay:')
    ? `e_${item.key.slice(6)}`
    : `${PREFIX[item.kind]}_${item.key}`;

export const itemOfCustomId = (customId: string) => {
  const [prefix, ...rest] = customId.split('_');
  const key = rest.join('_');
  return { kind: KIND_OF[prefix], key: prefix === 'e' ? `essay:${key}` : key };
};

const SYSTEM: Record<LabelKind, string> = {
  chat: CHAT_SYSTEM,
  test: TEST_SYSTEM,
  document: DOCUMENT_SYSTEM,
};
const SCHEMA: Record<LabelKind, Record<string, unknown>> = {
  chat: CHAT_SCHEMA,
  test: TEST_SCHEMA,
  document: DOCUMENT_SCHEMA,
};

/** The request for one item: Opus 5.5 at low effort, answering in that kind's JSON shape. */
export const labelRequest = (item: LabelItem) => ({
  custom_id: customIdOf(item),
  params: {
    model: INSIGHTS_MODEL,
    max_tokens: 4000,
    system: [
      {
        type: 'text' as const,
        text: SYSTEM[item.kind],
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    messages: [{ role: 'user' as const, content: item.content }],
    output_config: {
      effort: 'low' as const,
      format: { type: 'json_schema' as const, schema: SCHEMA[item.kind] },
    },
  },
});

const clip = (s: unknown, max: number) =>
  typeof s === 'string' ? s.trim().slice(0, max) : null;

/** The label columns for one of Claude's answers. */
export function labelFields(
  kind: LabelKind,
  out: any,
  details: Record<string, unknown>,
) {
  if (kind === 'document') {
    return {
      mood: null,
      confidence: null,
      intent: null,
      outcome: null,
      issues: null,
      summary: clip(out.summary, 400),
      quote: null,
      fixIdea: null,
      details: JSON.stringify({
        ...details,
        field: out.field,
        subject: clip(out.subject, 80),
        kind: out.kind,
        level: out.level,
        language: clip(out.language, 40),
        quality: out.quality,
      }),
    };
  }
  const issues = Array.isArray(out.issues)
    ? out.issues.filter((i: string) => i && i !== 'none')
    : [];
  return {
    mood: out.mood ?? null,
    confidence: out.confidence ?? null,
    intent: kind === 'chat' ? (out.intent ?? null) : null,
    outcome: out.outcome ?? null,
    issues: JSON.stringify(issues),
    summary: clip(out.summary, 400),
    quote: clip(out.quote, 400) || null,
    fixIdea: clip(out.fix_idea, 300) || null,
    details: JSON.stringify(
      kind === 'test'
        ? {
            ...details,
            stopReason: out.stop_reason,
            struggles: (out.struggles ?? []).slice(0, 3),
            strengths: (out.strengths ?? []).slice(0, 3),
          }
        : details,
    ),
  };
}

/** "2026-01" months from `from` to `to` (inclusive), as [start, end) instants. */
const monthsBetween = (from: string, to: string) => {
  const out: { month: string; start: Date; end: Date }[] = [];
  let m = from.slice(0, 7);
  while (m <= to.slice(0, 7)) {
    const [y, mo] = m.split('-').map(Number);
    const next = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7);
    const startDay = `${m}-01` < from ? from : `${m}-01`;
    const endDay =
      `${next}-01` > addDays(to, 1) ? addDays(to, 1) : `${next}-01`;
    out.push({
      month: m,
      start: watDayStart(startDay),
      end: watDayStart(endDay),
    });
    m = next;
  }
  return out;
};

const RESULT_COLUMNS: [string, string][] = [
  ['status', 'status'],
  ['mood', 'mood'],
  ['confidence', 'confidence'],
  ['intent', 'intent'],
  ['outcome', 'outcome'],
  ['issues', 'issues'],
  ['summary', 'summary'],
  ['quote', 'quote'],
  ['fixIdea', 'fix_idea'],
  ['details', 'details'],
  ['model', 'model'],
  ['promptVersion', 'prompt_version'],
  ['inputTokens', 'input_tokens'],
  ['outputTokens', 'output_tokens'],
  ['labelledOn', 'labelled_on'],
];

const sqlValue = (v: unknown) =>
  v instanceof Date
    ? v.toISOString().replace('T', ' ').replace('Z', '')
    : (v ?? null);

/**
 * Writes Claude's answers onto their pending labels, up to 100 per statement (the database is
 * remote, so one statement per label would take minutes). Fields a result doesn't have stay as
 * they were.
 */
async function saveLabelResults(rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const replacements: Record<string, unknown> = {};
  const tuples = rows.map((r, i) => {
    replacements[`k${i}`] = [r.kind, r.itemKey];
    return `(:k${i})`;
  });
  const sets = RESULT_COLUMNS.map(([prop, col]) => {
    const cases = rows
      .map((r, i) => {
        if (!(prop in r)) return '';
        replacements[`v${i}_${col}`] = sqlValue(r[prop]);
        return `WHEN :id${i} THEN :v${i}_${col}`;
      })
      .filter(Boolean);
    return cases.length
      ? `${col} = CASE id ${cases.join(' ')} ELSE ${col} END`
      : '';
  }).filter(Boolean);
  rows.forEach((r, i) => (replacements[`id${i}`] = r.id));
  await run(
    `UPDATE ai_label SET ${sets.join(', ')} WHERE (kind, item_key) IN (${tuples.join(', ')})`,
    replacements,
  );
}

/** Average cost per item from what's been labelled so far, with sensible starting guesses. */
const DEFAULT_TOKENS: Record<LabelKind, TokenTotals> = {
  chat: { input: 2600, cacheWrite: 0, cacheRead: 0, output: 500 },
  test: { input: 3200, cacheWrite: 0, cacheRead: 0, output: 500 },
  document: { input: 1800, cacheWrite: 0, cacheRead: 0, output: 350 },
};

@Injectable()
export class LabelService {
  /** Results handlers for other purposes (follow-up drafts) register here. */
  private importers = new Map<string, (batchId: string) => Promise<void>>();

  registerImporter(purpose: string, fn: (batchId: string) => Promise<void>) {
    this.importers.set(purpose, fn);
  }

  /** Everything not yet labelled between two WAT days, as label items. */
  async collect(
    kinds: LabelKind[],
    from: string,
    to: string,
    limitPerKind?: number,
  ) {
    const now = new Date();
    const settledChat = new Date(now.getTime() - 2 * 3600_000);
    const settledTest = new Date(now.getTime() - 24 * 3600_000);
    const out: LabelItem[] = [];
    const counts: Record<LabelKind, number> = { chat: 0, test: 0, document: 0 };
    for (const { start, end } of monthsBetween(from, to).reverse()) {
      for (const kind of kinds) {
        if (limitPerKind && counts[kind] >= limitPerKind) continue;
        let items: LabelItem[] = [];
        if (kind === 'chat')
          items = await collectChats(start, end, settledChat);
        if (kind === 'test')
          items = [
            ...(await collectTests(start, end, settledTest)),
            ...(await collectEssays(start, end)),
          ];
        if (kind === 'document') items = await collectDocuments(start, end);
        if (limitPerKind) items = items.slice(0, limitPerKind - counts[kind]);
        counts[kind] += items.length;
        out.push(...items);
      }
    }
    return { items: out, counts };
  }

  /** Sends everything unlabelled in the range to Claude, in batches. */
  async submit(opts: {
    kinds: LabelKind[];
    from: string;
    to: string;
    limitPerKind?: number;
    requestedBy?: string | null;
  }) {
    const kinds = opts.kinds.filter((k) => LABEL_KINDS.includes(k));
    if (!kinds.length)
      throw new HttpException('Pick what to label', HttpStatus.BAD_REQUEST);
    const { items, counts } = await this.collect(
      kinds,
      opts.from,
      opts.to,
      opts.limitPerKind,
    );
    const batches: string[] = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);
      const batch = await claude().messages.batches.create({
        requests: chunk.map(labelRequest) as any,
      });
      const now = new Date();
      await AiBatchModel.create({
        id: batch.id,
        purpose: 'labels',
        status: 'submitted',
        itemCount: chunk.length,
        note: `${opts.from} to ${opts.to} · ${kinds.join(', ')}${opts.limitPerKind ? ` · sample of ${opts.limitPerKind}` : ''}`,
        requestedBy: opts.requestedBy ?? null,
        submittedOn: now,
        updatedOn: now,
      } as AiBatchModel);
      // A pending label per item: what's in flight, and who/what/when it's about.
      for (let j = 0; j < chunk.length; j += 200) {
        await this.upsertPending(chunk.slice(j, j + 200), batch.id);
      }
      batches.push(batch.id);
    }
    return { batches, items: items.length, counts };
  }

  private async upsertPending(items: LabelItem[], batchId: string) {
    if (!items.length) return;
    const now = new Date();
    const rows = items.map((it) => [
      generateUUID(),
      it.kind,
      it.key,
      it.userId,
      it.documentId,
      it.occurredOn,
      'pending',
      batchId,
      JSON.stringify(it.details ?? {}),
      now,
    ]);
    const placeholders = rows.map((_, i) => `(:r${i})`).join(', ');
    const replacements: Record<string, unknown> = {};
    rows.forEach((r, i) => {
      replacements[`r${i}`] = r.map((v) =>
        v instanceof Date
          ? v.toISOString().replace('T', ' ').replace('Z', '')
          : v,
      );
    });
    await run(
      `INSERT INTO ai_label (id, kind, item_key, user_id, document_id, occurred_on, status, batch_id, details, created_on)
       VALUES ${placeholders} AS fresh
       ON DUPLICATE KEY UPDATE status = 'pending', batch_id = fresh.batch_id, details = fresh.details`,
      replacements,
    );
  }

  /** Checks batches in flight and imports the ones that have finished. */
  async poll() {
    const open = await AiBatchModel.findAll({
      where: { status: ['submitted', 'importing'] },
      order: [['submittedOn', 'ASC']],
    });
    for (const b of open) {
      if (
        b.status === 'importing' &&
        Date.now() - new Date(b.updatedOn).getTime() < IMPORT_STALE_MS
      )
        continue;
      let remote;
      try {
        remote = await claude().messages.batches.retrieve(b.id);
      } catch (error) {
        console.error('insights: could not check batch', b.id, error?.message);
        continue;
      }
      if (remote.processing_status !== 'ended') continue;
      // Claim it so two servers don't import the same batch.
      const [claimed] = await AiBatchModel.update(
        {
          status: 'importing',
          endedOn: remote.ended_at ? new Date(remote.ended_at) : new Date(),
          updatedOn: new Date(),
        },
        { where: { id: b.id, status: b.status } },
      );
      if (!claimed) continue;
      try {
        if (b.purpose === 'labels') await this.importLabels(b.id);
        else await this.importers.get(b.purpose)?.(b.id);
      } catch (error) {
        console.error('insights: import failed', b.id, error?.message);
        await AiBatchModel.update(
          { status: 'submitted', updatedOn: new Date() },
          { where: { id: b.id } },
        );
      }
    }
  }

  private async importLabels(batchId: string) {
    const totals: TokenTotals = {
      input: 0,
      cacheWrite: 0,
      cacheRead: 0,
      output: 0,
    };
    let done = 0;
    let failed = 0;
    const existing = await AiLabelModel.findAll({ where: { batchId } });
    const byKey = new Map(existing.map((l) => [`${l.kind}|${l.itemKey}`, l]));
    const rows: Record<string, unknown>[] = [];
    for await (const result of await claude().messages.batches.results(
      batchId,
    )) {
      const { kind, key } = itemOfCustomId(result.custom_id);
      const label = kind ? byKey.get(`${kind}|${key}`) : undefined;
      if (!kind || !label) continue;
      const details = label.details ? JSON.parse(label.details) : {};
      const base = { id: label.id, kind, itemKey: key };
      if (result.result.type !== 'succeeded') {
        failed++;
        rows.push({ ...base, status: 'failed' });
        continue;
      }
      const message = result.result.message;
      const t = tokensOf(message.usage);
      totals.input += t.input;
      totals.cacheWrite += t.cacheWrite;
      totals.cacheRead += t.cacheRead;
      totals.output += t.output;
      const tokens = {
        inputTokens: t.input + t.cacheRead + t.cacheWrite,
        outputTokens: t.output,
      };
      const out =
        message.stop_reason === 'refusal'
          ? null
          : jsonOf<any>(message.content as any);
      if (!out) {
        failed++;
        rows.push({
          ...base,
          ...tokens,
          status: message.stop_reason === 'refusal' ? 'skipped' : 'failed',
        });
        continue;
      }
      done++;
      rows.push({
        ...base,
        ...tokens,
        ...labelFields(kind, out, details),
        status: 'done',
        model: message.model ?? INSIGHTS_MODEL,
        promptVersion: PROMPT_VERSION,
        labelledOn: new Date(),
      });
    }
    for (let i = 0; i < rows.length; i += 100)
      await saveLabelResults(rows.slice(i, i + 100));
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
    this.clearCoverage();
  }

  /** Batches, newest first, with what they cost. */
  async batches(limit = 20) {
    const rows = await AiBatchModel.findAll({
      order: [['submittedOn', 'DESC']],
      limit,
    });
    return rows.map((b) => ({
      id: b.id,
      purpose: b.purpose,
      status: b.status,
      items: b.itemCount,
      done: b.doneCount,
      failed: b.failedCount,
      note: b.note,
      submittedOn: b.submittedOn,
      endedOn: b.endedOn,
      cost: costOf({
        input: Number(b.inputTokens),
        cacheWrite: Number(b.cacheWriteTokens),
        cacheRead: Number(b.cacheReadTokens),
        output: Number(b.outputTokens),
      }),
    }));
  }

  /** Average cost of one item of each kind, from what's been labelled (or a starting guess). */
  async costPerItem(): Promise<Record<LabelKind, number>> {
    const rows = await select<{
      kind: LabelKind;
      n: number;
      i: number;
      o: number;
    }>(
      `SELECT kind, COUNT(*) AS n, AVG(input_tokens) AS i, AVG(output_tokens) AS o FROM ai_label
       WHERE status = 'done' AND input_tokens IS NOT NULL GROUP BY kind`,
    );
    const out = {} as Record<LabelKind, number>;
    for (const kind of LABEL_KINDS) {
      const r = rows.find((x) => x.kind === kind);
      const t =
        r && Number(r.n) >= 10
          ? {
              input: Number(r.i),
              cacheWrite: 0,
              cacheRead: 0,
              output: Number(r.o),
            }
          : DEFAULT_TOKENS[kind];
      out[kind] = costOf(t, BATCH_PRICE);
    }
    return out;
  }

  private coverageCache: { at: number; value: Promise<any> } | null = null;

  /** Per month since the start: how many items there are and how many are labelled, by kind. */
  coverage(fresh = false) {
    if (
      !fresh &&
      this.coverageCache &&
      Date.now() - this.coverageCache.at < 5 * 60_000
    )
      return this.coverageCache.value;
    const value = this.buildCoverage().catch((e) => {
      this.coverageCache = null;
      throw e;
    });
    this.coverageCache = { at: Date.now(), value };
    return value;
  }

  clearCoverage() {
    this.coverageCache = null;
  }

  private async buildCoverage() {
    const month = (col: string) =>
      `DATE_FORMAT(DATE_ADD(${col}, INTERVAL 1 HOUR), '%Y-%m')`;
    const [chats, tests, essays, docs, labels, perItem, spent] =
      await Promise.all([
        select<{ m: string; n: number }>(
          `SELECT ${month('started')} AS m, COUNT(*) AS n FROM (
           SELECT MIN(created_on) AS started, SUM(sender = 'user') AS asked FROM (
             SELECT user_id, course_document_id, created_on, sender,
                    SUM(gap) OVER (PARTITION BY user_id, course_document_id ORDER BY created_on, id) AS grp
             FROM (SELECT id, user_id, course_document_id, created_on, sender,
                     CASE WHEN TIMESTAMPDIFF(MINUTE, LAG(created_on) OVER (PARTITION BY user_id, course_document_id ORDER BY created_on, id), created_on) <= 30 THEN 0 ELSE 1 END AS gap
                   FROM document_message) m) g
           GROUP BY user_id, course_document_id, grp) c WHERE asked > 0 GROUP BY m`,
        ),
        select<{ m: string; n: number }>(
          `SELECT ${month('modified_on')} AS m, COUNT(*) AS n FROM question_progress
         WHERE JSON_LENGTH(JSON_UNQUOTE(data)) >= 3 GROUP BY m`,
        ),
        select<{ m: string; n: number }>(
          `SELECT ${month('created_on')} AS m, COUNT(*) AS n FROM essay_question_analysis GROUP BY m`,
        ),
        select<{ m: string; n: number }>(
          `SELECT ${month('created_on')} AS m, COUNT(*) AS n FROM course_document GROUP BY m`,
        ),
        select<{ kind: LabelKind; m: string; status: string; n: number }>(
          `SELECT kind, ${month('occurred_on')} AS m, status, COUNT(*) AS n FROM ai_label GROUP BY kind, m, status`,
        ),
        this.costPerItem(),
        select<{ i: number; cw: number; cr: number; o: number }>(
          `SELECT SUM(input_tokens) AS i, SUM(cache_write_tokens) AS cw, SUM(cache_read_tokens) AS cr, SUM(output_tokens) AS o FROM ai_batch`,
        ),
      ]);
    const map = (rows: { m: string; n: number }[]) =>
      new Map(rows.map((r) => [r.m, Number(r.n)]));
    const totals: Record<LabelKind, Map<string, number>> = {
      chat: map(chats),
      test: new Map(),
      document: map(docs),
    };
    for (const r of [...tests, ...essays])
      totals.test.set(r.m, (totals.test.get(r.m) ?? 0) + Number(r.n));
    const months: string[] = [];
    for (let m = FIRST_MONTH; m <= watDay().slice(0, 7); ) {
      months.push(m);
      const [y, mo] = m.split('-').map(Number);
      m = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7);
    }
    return {
      generatedAt: new Date().toISOString(),
      costPerItem: perItem,
      spent: costOf({
        input: Number(spent[0]?.i ?? 0),
        cacheWrite: Number(spent[0]?.cw ?? 0),
        cacheRead: Number(spent[0]?.cr ?? 0),
        output: Number(spent[0]?.o ?? 0),
      }),
      months: months.map((m) => {
        const row: Record<string, unknown> = { month: m };
        for (const kind of LABEL_KINDS) {
          const of = (status: string) =>
            Number(
              labels.find(
                (l) => l.kind === kind && l.m === m && l.status === status,
              )?.n ?? 0,
            );
          row[kind] = {
            total: totals[kind].get(m) ?? 0,
            done: of('done') + of('skipped'),
            pending: of('pending'),
            failed: of('failed'),
          };
        }
        return row;
      }),
    };
  }

  /** How many items a run would label, and roughly what it would cost (from the coverage counts). */
  async estimate(kinds: LabelKind[], from: string, to: string) {
    const cov = await this.coverage();
    let items = 0;
    let dollars = 0;
    const byKind: Record<string, number> = {};
    for (const row of cov.months as any[]) {
      if (row.month < from.slice(0, 7) || row.month > to.slice(0, 7)) continue;
      for (const kind of kinds) {
        const c = row[kind];
        const left = Math.max(0, c.total - c.done - c.pending);
        byKind[kind] = (byKind[kind] ?? 0) + left;
        items += left;
        dollars += left * cov.costPerItem[kind];
      }
    }
    return { items, byKind, dollars: Math.round(dollars * 100) / 100 };
  }

  /** Re-labels tests that were stopped when labelled but have since been finished. */
  async staleTests() {
    const rows = await select<{ item_key: string }>(
      `SELECT l.item_key FROM ai_label l JOIN question_progress qp ON qp.id = l.item_key
       WHERE l.kind = 'test' AND l.status = 'done' AND qp.status = 'submitted'
         AND JSON_UNQUOTE(JSON_EXTRACT(l.details, '$.status')) = 'stopped' LIMIT 500`,
    );
    if (rows.length)
      await run(
        `UPDATE ai_label SET status = 'failed' WHERE kind = 'test' AND item_key IN (:keys)`,
        {
          keys: rows.map((r) => r.item_key),
        },
      );
    return rows.length;
  }
}

export const labelRange = (days: number) => {
  const to = watDay();
  return { from: addDays(to, -days), to };
};
