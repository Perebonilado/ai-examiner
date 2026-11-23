import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InsightsJobs } from '../insights/InsightsJobs';
import { memberEmails, normalEmail } from '../adminAccess';
import { parseRange } from '../range';
import { iso, run, select } from '../sql';
import { AppEventModel } from './AppEventModel';

/** Events the app may send. Anything else is ignored. */
export const EVENT_NAMES = new Set([
  'page_view',
  'page_leave',
  'signed_up',
  'signed_in',
  'email_confirmed',
  'upload_started',
  'upload_done',
  'upload_failed',
  'test_generate_started',
  'test_generate_done',
  'test_generate_failed',
  'test_opened',
  'test_left',
  'test_submitted',
  'chat_sent',
  'chat_first_text',
  'chat_done',
  'chat_stopped',
  'chat_failed',
  'chat_retry',
  'easy_read_opened',
  'limit_hit',
  'upgrade_shown',
  'checkout_started',
  'checkout_result',
  'api_error',
  'js_error',
  'survey_answer',
  'email_clicked',
]);

const MAX_BATCH = 50;
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX = 600;
const DAY = 86_400_000;

const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** "/questions/view-questions/87d6…?x=1" → "/questions/view-questions/:id". */
export const cleanPath = (p: unknown) => {
  if (typeof p !== 'string' || !p.startsWith('/')) return null;
  return p
    .split(/[?#]/)[0]
    .replace(UUID, ':id')
    .replace(/\/[0-9a-f]{24,}(?=\/|$)/gi, '/:id')
    .replace(/\/\d{4,}(?=\/|$)/g, '/:id')
    .slice(0, 200);
};

/** Only short, flat details: strings, numbers and true/false. */
const cleanProps = (props: unknown) => {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return null;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props).slice(0, 12)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,29}$/.test(k)) continue;
    if (typeof v === 'string') out[k] = v.slice(0, 300);
    else if (typeof v === 'number' && Number.isFinite(v))
      out[k] = Math.round(v * 1000) / 1000;
    else if (typeof v === 'boolean') out[k] = v;
  }
  const json = JSON.stringify(out);
  return json === '{}' ? null : json.slice(0, 1500);
};

const percentile = (sorted: number[], p: number) =>
  sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
    : null;

export interface EventBatch {
  sessionId?: unknown;
  anonId?: unknown;
  events?: unknown;
}

/**
 * What students do in the app, event by event: collected from the app, then summed up for the
 * admin pages, the assistant and the product ideas.
 */
@Injectable()
export class TelemetryService implements OnModuleInit {
  constructor(@Inject(InsightsJobs) private jobs: InsightsJobs) {}

  onModuleInit() {
    this.jobs.schedule({
      name: 'trim_events',
      hour: 3,
      run: () => this.trim(),
    });
  }

  private rate = new Map<string, { start: number; n: number }>();
  private linked = new Set<string>();

  private allow(key: string, n: number) {
    const now = Date.now();
    const r = this.rate.get(key);
    if (!r || now - r.start > RATE_WINDOW_MS) {
      if (this.rate.size > 20_000) this.rate.clear();
      this.rate.set(key, { start: now, n });
      return true;
    }
    r.n += n;
    return r.n <= RATE_MAX;
  }

  async ingest(body: EventBatch, who: { userId: string | null; ip: string }) {
    const events = Array.isArray(body?.events)
      ? body.events.slice(0, MAX_BATCH)
      : [];
    if (!events.length) return 0;
    const anonId = /^[a-zA-Z0-9-]{8,36}$/.test(String(body.anonId ?? ''))
      ? String(body.anonId)
      : null;
    const sessionId = /^[a-zA-Z0-9-]{8,36}$/.test(String(body.sessionId ?? ''))
      ? String(body.sessionId)
      : null;
    if (!sessionId) return 0;
    if (!this.allow(who.userId ?? anonId ?? who.ip, events.length)) return 0;

    const now = Date.now();
    const rows = events
      .filter((e: any) => e && EVENT_NAMES.has(e.name))
      .map((e: any) => {
        const at = Number(e.at);
        const ms = Number(e.ms);
        return {
          userId: who.userId,
          anonId,
          sessionId,
          name: clip(e.name, 40),
          path: cleanPath(e.path),
          ms:
            Number.isFinite(ms) && ms >= 0
              ? Math.min(Math.round(ms), 6 * 3_600_000)
              : null,
          props: cleanProps(e.props),
          // The browser's clock, unless it's far off.
          at: new Date(
            Number.isFinite(at) && at < now + 60_000 && at > now - 2 * DAY
              ? at
              : now,
          ),
          createdOn: new Date(now),
        };
      });
    if (!rows.length) return 0;
    await AppEventModel.bulkCreate(rows as AppEventModel[]);

    // Once someone signs in, their visits from before signing in become theirs too.
    if (who.userId && anonId && !this.linked.has(`${anonId}|${who.userId}`)) {
      this.linked.add(`${anonId}|${who.userId}`);
      if (this.linked.size > 50_000) this.linked.clear();
      await run(
        `UPDATE app_event SET user_id = :u WHERE anon_id = :a AND user_id IS NULL`,
        {
          u: who.userId,
          a: anonId,
        },
      ).catch(() => undefined);
    }
    return rows.length;
  }

  /** Admin accounts, left out of every number. */
  private async staffIds() {
    const emails = new Set<string>(
      (process.env.ADMIN_EMAILS ?? '')
        .split(',')
        .map((e) => normalEmail(e))
        .filter(Boolean),
    );
    for (const e of await memberEmails()) emails.add(e);
    if (!emails.size) return ['-'];
    const rows = await select<{ id: string }>(
      `SELECT id FROM user WHERE LOWER(email) IN (:emails)`,
      {
        emails: [...emails],
      },
    );
    return rows.length ? rows.map((r) => r.id) : ['-'];
  }

  /** Where students get stuck in a date range: steps, waits, failures and where visits end. */
  async report(q: { from?: string; to?: string }) {
    const range = parseRange(q.from, q.to, new Date(), 30);
    const staff = await this.staffIds();
    const r = { start: range.start, end: range.end, staff };
    const base = `at >= :start AND at < :end AND (user_id IS NULL OR user_id NOT IN (:staff))`;

    const [
      since,
      totals,
      steps,
      waitRows,
      failures,
      apiErrors,
      jsErrors,
      limits,
      exits,
      pages,
      left,
    ] = await Promise.all([
      select<{ at: Date }>(`SELECT MIN(at) AS at FROM app_event`),
      select<any>(
        `SELECT COUNT(DISTINCT session_id) AS sessions, COUNT(DISTINCT user_id) AS students,
                COUNT(DISTINCT CASE WHEN user_id IS NULL THEN anon_id END) AS visitors, COUNT(*) AS events
         FROM app_event WHERE ${base}`,
        r,
      ),
      select<{ step: string; n: number }>(
        `SELECT 'upload_page' AS step, COUNT(DISTINCT COALESCE(user_id, anon_id)) AS n FROM app_event
           WHERE ${base} AND name = 'page_view' AND path = '/new-document'
         UNION ALL SELECT name, COUNT(DISTINCT COALESCE(user_id, anon_id)) FROM app_event
           WHERE ${base} AND name IN ('upload_started', 'upload_done', 'test_generate_done', 'test_opened', 'test_submitted')
           GROUP BY name`,
        r,
      ),
      select<{ name: string; ms: number }>(
        `SELECT name, ms FROM app_event
         WHERE ${base} AND ms IS NOT NULL AND name IN ('upload_done', 'test_generate_done', 'chat_first_text', 'chat_done')
         ORDER BY id DESC LIMIT 20000`,
        r,
      ),
      select<{ name: string; n: number; people: number }>(
        `SELECT name, COUNT(*) AS n, COUNT(DISTINCT COALESCE(user_id, anon_id)) AS people FROM app_event
         WHERE ${base} AND name IN ('upload_failed', 'test_generate_failed', 'chat_failed', 'chat_stopped', 'test_left', 'upgrade_shown', 'checkout_started', 'checkout_result')
         GROUP BY name`,
        r,
      ),
      select<{ endpoint: string; status: string; n: number }>(
        `SELECT JSON_UNQUOTE(JSON_EXTRACT(props, '$.endpoint')) AS endpoint, JSON_UNQUOTE(JSON_EXTRACT(props, '$.status')) AS status, COUNT(*) AS n
         FROM app_event WHERE ${base} AND name = 'api_error' GROUP BY endpoint, status ORDER BY n DESC LIMIT 10`,
        r,
      ),
      select<{ message: string; n: number }>(
        `SELECT JSON_UNQUOTE(JSON_EXTRACT(props, '$.message')) AS message, COUNT(*) AS n
         FROM app_event WHERE ${base} AND name = 'js_error' GROUP BY message ORDER BY n DESC LIMIT 8`,
        r,
      ),
      select<{ which: string; n: number; people: number }>(
        `SELECT JSON_UNQUOTE(JSON_EXTRACT(props, '$.which')) AS which, COUNT(*) AS n, COUNT(DISTINCT COALESCE(user_id, anon_id)) AS people
         FROM app_event WHERE ${base} AND name = 'limit_hit' GROUP BY which ORDER BY n DESC`,
        r,
      ),
      select<{ exit_path: string; n: number }>(
        `SELECT COALESCE(e.path, JSON_UNQUOTE(JSON_EXTRACT(e.props, '$.page'))) AS exit_path, COUNT(*) AS n FROM app_event e
         JOIN (SELECT session_id, MAX(id) AS last_id FROM app_event WHERE ${base} AND name IN ('page_view', 'page_leave') GROUP BY session_id) x
           ON x.last_id = e.id
         GROUP BY exit_path ORDER BY n DESC LIMIT 10`,
        r,
      ),
      select<{ path: string; views: number; people: number }>(
        `SELECT path, COUNT(*) AS views, COUNT(DISTINCT COALESCE(user_id, anon_id)) AS people FROM app_event
         WHERE ${base} AND name = 'page_view' GROUP BY path ORDER BY views DESC LIMIT 12`,
        r,
      ),
      select<{ answered: string; total: string }>(
        `SELECT JSON_EXTRACT(props, '$.answered') AS answered, JSON_EXTRACT(props, '$.total') AS total
         FROM app_event WHERE ${base} AND name = 'test_left' LIMIT 5000`,
        r,
      ),
    ]);

    const person = 'COALESCE(user_id, anon_id)';
    const [testRows, signRows, promptRows, payRows, pageTime, activity] =
      await Promise.all([
        select<{
          type: string;
          name: string;
          n: number;
          people: number;
          blank: number;
        }>(
          `SELECT JSON_UNQUOTE(JSON_EXTRACT(props, '$.type')) AS type, name, COUNT(*) AS n, COUNT(DISTINCT ${person}) AS people,
                SUM(JSON_UNQUOTE(JSON_EXTRACT(props, '$.blank')) = 'true') AS blank
         FROM app_event WHERE ${base} AND name IN ('test_opened', 'test_submitted', 'test_left') GROUP BY type, name`,
          r,
        ),
        select<{ name: string; method: string; n: number }>(
          `SELECT name, JSON_UNQUOTE(JSON_EXTRACT(props, '$.method')) AS method, COUNT(*) AS n
         FROM app_event WHERE ${base} AND name IN ('signed_up', 'signed_in') GROUP BY name, method ORDER BY n DESC`,
          r,
        ),
        select<{ prompt: string; n: number; people: number }>(
          `SELECT JSON_UNQUOTE(JSON_EXTRACT(props, '$.prompt')) AS prompt, COUNT(*) AS n, COUNT(DISTINCT ${person}) AS people
         FROM app_event WHERE ${base} AND name = 'upgrade_shown' GROUP BY prompt ORDER BY n DESC LIMIT 8`,
          r,
        ),
        select<{ status: string; n: number; people: number }>(
          `SELECT JSON_UNQUOTE(JSON_EXTRACT(props, '$.status')) AS status, COUNT(*) AS n, COUNT(DISTINCT ${person}) AS people
         FROM app_event WHERE ${base} AND name = 'checkout_result' GROUP BY status`,
          r,
        ),
        select<{ page: string; ms: number }>(
          `SELECT JSON_UNQUOTE(JSON_EXTRACT(props, '$.page')) AS page, ms FROM app_event
         WHERE ${base} AND name = 'page_leave' AND ms IS NOT NULL ORDER BY id DESC LIMIT 20000`,
          r,
        ),
        select<{ name: string; n: number; people: number }>(
          `SELECT name, COUNT(*) AS n, COUNT(DISTINCT ${person}) AS people FROM app_event
         WHERE ${base} AND name IN ('chat_sent', 'chat_retry', 'easy_read_opened', 'test_generate_started') GROUP BY name`,
          r,
        ),
      ]);
    const timeOn = new Map<string, number[]>();
    for (const t of pageTime) {
      const list = timeOn.get(t.page) ?? [];
      list.push(Number(t.ms));
      timeOn.set(t.page, list);
    }
    const median = (page: string) =>
      percentile(
        (timeOn.get(page) ?? []).sort((a, b) => a - b),
        50,
      );
    const types = [...new Set(testRows.map((t) => t.type ?? 'unknown'))];
    const testCell = (type: string, name: string) =>
      testRows.find((t) => (t.type ?? 'unknown') === type && t.name === name);
    const pay = (status: string) => {
      const p = payRows.find((x) => x.status === status);
      return { count: Number(p?.n ?? 0), people: Number(p?.people ?? 0) };
    };
    const act = (name: string) => {
      const a = activity.find((x) => x.name === name);
      return { count: Number(a?.n ?? 0), people: Number(a?.people ?? 0) };
    };

    const byName = new Map<string, number[]>();
    for (const w of waitRows) {
      const list = byName.get(w.name) ?? [];
      list.push(Number(w.ms));
      byName.set(w.name, list);
    }
    const wait = (name: string) => {
      const list = (byName.get(name) ?? []).sort((a, b) => a - b);
      return {
        count: list.length,
        p50: percentile(list, 50),
        p90: percentile(list, 90),
      };
    };
    const step = (k: string) => Number(steps.find((s) => s.step === k)?.n ?? 0);
    const fail = (k: string) => {
      const f = failures.find((x) => x.name === k);
      return { count: Number(f?.n ?? 0), people: Number(f?.people ?? 0) };
    };
    const leftShare = left
      .map((l) => Number(l.answered) / Math.max(1, Number(l.total)))
      .filter((x) => Number.isFinite(x));

    return {
      range: { from: range.from, to: range.to },
      since: iso(since[0]?.at),
      totals: {
        sessions: Number(totals[0]?.sessions ?? 0),
        students: Number(totals[0]?.students ?? 0),
        visitors: Number(totals[0]?.visitors ?? 0),
        events: Number(totals[0]?.events ?? 0),
      },
      steps: [
        {
          key: 'upload_page',
          label: 'Opened the upload page',
          count: step('upload_page'),
        },
        {
          key: 'upload_started',
          label: 'Started an upload',
          count: step('upload_started'),
        },
        {
          key: 'upload_done',
          label: 'Upload finished',
          count: step('upload_done'),
        },
        {
          key: 'test_generate_done',
          label: 'Made a test',
          count: step('test_generate_done'),
        },
        {
          key: 'test_opened',
          label: 'Opened a test',
          count: step('test_opened'),
        },
        {
          key: 'test_submitted',
          label: 'Finished a test',
          count: step('test_submitted'),
        },
      ],
      waits: {
        upload: wait('upload_done'),
        testGeneration: wait('test_generate_done'),
        chatFirstWords: wait('chat_first_text'),
        chatWholeReply: wait('chat_done'),
      },
      failures: {
        uploads: fail('upload_failed'),
        testGeneration: fail('test_generate_failed'),
        chat: fail('chat_failed'),
        chatStopped: fail('chat_stopped'),
        testsLeft: {
          ...fail('test_left'),
          averageShareAnswered: leftShare.length
            ? Math.round(
                (leftShare.reduce((a, b) => a + b, 0) / leftShare.length) * 100,
              )
            : null,
        },
        upgradeShown: fail('upgrade_shown'),
        checkoutStarted: fail('checkout_started'),
        checkoutFinished: pay('active'),
        checkoutNotConfirmed: pay('not_confirmed'),
        blankEssays: {
          count: Number(
            testRows.find(
              (t) => t.type === 'essay' && t.name === 'test_submitted',
            )?.blank ?? 0,
          ),
          people: 0,
        },
      },
      tests: types
        .map((type) => ({
          type,
          opened: Number(testCell(type, 'test_opened')?.people ?? 0),
          finished: Number(testCell(type, 'test_submitted')?.people ?? 0),
          left: Number(testCell(type, 'test_left')?.people ?? 0),
          blank: Number(testCell(type, 'test_submitted')?.blank ?? 0),
        }))
        .sort((a, b) => b.opened - a.opened),
      accounts: {
        signUps: signRows
          .filter((x) => x.name === 'signed_up')
          .map((x) => ({ method: x.method ?? 'unknown', count: Number(x.n) })),
        signIns: signRows
          .filter((x) => x.name === 'signed_in')
          .reduce((a, x) => a + Number(x.n), 0),
      },
      activity: {
        chatQuestions: act('chat_sent'),
        chatRetries: act('chat_retry'),
        easyReadOpens: act('easy_read_opened'),
        testsRequested: act('test_generate_started'),
      },
      upgradePrompts: promptRows.map((p) => ({
        prompt: p.prompt ?? 'unknown',
        count: Number(p.n),
        people: Number(p.people),
      })),
      limits: limits.map((l) => ({
        which: l.which ?? 'unknown',
        count: Number(l.n),
        people: Number(l.people),
      })),
      apiErrors: apiErrors.map((e) => ({
        endpoint: e.endpoint ?? '?',
        status: e.status ?? '?',
        count: Number(e.n),
      })),
      jsErrors: jsErrors.map((e) => ({
        message: e.message ?? '?',
        count: Number(e.n),
      })),
      exitPages: exits.map((e) => ({
        path: e.exit_path ?? '?',
        sessions: Number(e.n),
      })),
      topPages: pages.map((p) => ({
        path: p.path ?? '?',
        views: Number(p.views),
        people: Number(p.people),
        medianMs: median(p.path),
      })),
    };
  }

  /** One student's recent visits, event by event. */
  async timeline(userId: string, limit = 300) {
    const rows = await select<any>(
      `SELECT session_id, name, path, ms, props, at FROM app_event WHERE user_id = :u ORDER BY at DESC, id DESC LIMIT :limit`,
      { u: userId, limit: Math.min(1000, Math.max(1, limit)) },
    );
    const sessions = new Map<
      string,
      { sessionId: string; start: string; end: string; events: any[] }
    >();
    for (const r of rows) {
      const at = iso(r.at)!;
      const s = sessions.get(r.session_id) ?? {
        sessionId: r.session_id,
        start: at,
        end: at,
        events: [],
      };
      s.events.push({
        name: r.name,
        path: r.path,
        ms: r.ms === null ? null : Number(r.ms),
        props: r.props ? JSON.parse(r.props) : null,
        at,
      });
      if (at < s.start) s.start = at;
      if (at > s.end) s.end = at;
      sessions.set(r.session_id, s);
    }
    return [...sessions.values()].map((s) => ({
      ...s,
      events: s.events.reverse(),
    }));
  }

  /** Keeps a year of events. */
  async trim() {
    await run(`DELETE FROM app_event WHERE at < :cut LIMIT 50000`, {
      cut: new Date(Date.now() - 366 * DAY),
    });
  }
}
