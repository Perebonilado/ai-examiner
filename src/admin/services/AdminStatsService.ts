import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import axios from 'axios';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { PaystackSubscriptionService } from 'src/integrations/paystack/services/PaystackSubscriptionService';
import { USAGE_ROWS_SQL } from '../analytics';
import {
  EventRow,
  OnlinePerson,
  RECENT_SIGNALS_SQL,
  SESSION_LOOKBACK_MS,
  SignalRow,
  describeEvent,
  eventsUnion,
  onlineFromSignals,
} from '../events';
import { ACTIVITY_TYPES, ActivityType } from '../models/ActivityModels';
import { DayRange, MAX_RANGE_DAYS, parseRange } from '../range';
import {
  IS_PAID_SQL,
  LAST_ACTIVE_SQL,
  ONLINE_WINDOW_MS,
  USER_FACTS_JOINS,
  fullName,
  iso,
  isGuestEmail,
  select,
} from '../sql';
import { startOfWatDay, watDay } from '../time';

export type Segment =
  | 'all'
  | 'online'
  | 'active_today'
  | 'active_7d'
  | 'active_30d'
  | 'inactive_30d'
  | 'never_used';
const SEGMENTS: Segment[] = [
  'all',
  'online',
  'active_today',
  'active_7d',
  'active_30d',
  'inactive_30d',
  'never_used',
];

export type UserSort =
  | 'last_active'
  | 'created_on'
  | 'name'
  | 'documents'
  | 'tests'
  | 'finished'
  | 'score'
  | 'reading';
/** The columns each sort orders by. */
const SORTS: Record<UserSort, string[]> = {
  last_active: ['t.last_active'],
  created_on: ['t.created_on'],
  name: ['t.first_name', 't.last_name'],
  documents: ['t.documents'],
  tests: ['t.tests'],
  finished: ['t.finished'],
  score: ['t.avg_score'],
  reading: ['t.reading'],
};

export interface UsersParams {
  search?: string;
  segment?: string;
  plan?: string;
  joinedFrom?: string;
  joinedTo?: string;
  sort?: string;
  dir?: string;
  page?: number;
  pageSize?: number;
}

export interface ActivityParams {
  from?: string;
  to?: string;
  /** Comma-separated kinds. */
  types?: string;
  search?: string;
  userId?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  // Cells starting with = + - @ would run as formulas in a spreadsheet.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export interface ActivityItem {
  id: string;
  type: ActivityType;
  userId: string;
  userName: string;
  detail: string;
  createdOn: string;
}

/** Plan names from Paystack, keyed by plan code. Plans rarely change, so they're cached. */
const PLAN_CACHE_MS = 6 * 60 * 60 * 1000;
const PLAN_RETRY_MS = 10 * 60 * 1000;

const escapeLike = (text: string) =>
  `%${text.trim().replace(/[%_\\]/g, (m) => `\\${m}`)}%`;

/** Counts behind the activity log, kept a minute so paging through doesn't recount. */
const COUNT_TTL_MS = 60 * 1000;

@Injectable()
export class AdminStatsService {
  private plans: { at: number; names: Map<string, string> } | null = null;
  private counted = new Map<string, { at: number; value: Promise<any> }>();

  /** `make()` once per key per minute. */
  private remember<T>(key: string, make: () => Promise<T>): Promise<T> {
    const hit = this.counted.get(key);
    if (hit && Date.now() - hit.at < COUNT_TTL_MS) return hit.value;
    const value = make().catch((err) => {
      this.counted.delete(key);
      throw err;
    });
    if (this.counted.size > 100) this.counted.clear();
    this.counted.set(key, { at: Date.now(), value });
    return value;
  }

  constructor(
    @Inject(PaystackSubscriptionService)
    private paystack: PaystackSubscriptionService,
  ) {}

  /** Who is online now (heartbeat or a recent action), keyed by user id. */
  async onlinePeople(now = new Date()): Promise<Map<string, OnlinePerson>> {
    const rows = await select<SignalRow>(RECENT_SIGNALS_SQL, {
      onlineSince: new Date(now.getTime() - ONLINE_WINDOW_MS),
      sessionSince: new Date(now.getTime() - SESSION_LOOKBACK_MS),
    });
    return onlineFromSignals(rows, now);
  }

  private async planNames(): Promise<Map<string, string>> {
    const fresh =
      this.plans &&
      Date.now() - this.plans.at <
        (this.plans.names.size ? PLAN_CACHE_MS : PLAN_RETRY_MS);
    if (fresh) return this.plans!.names;
    const names = new Map<string, string>();
    try {
      const res = await axios.get('https://api.paystack.co/plan?perPage=100', {
        headers: {
          Authorization: `Bearer ${EnvironmentVariables.config.paystackSecretKey}`,
        },
        timeout: 4000,
      });
      for (const plan of res.data?.data ?? []) {
        if (plan?.plan_code && plan?.name)
          names.set(plan.plan_code, String(plan.name));
      }
    } catch {
      // Purchases then read "bought a one-time plan" until the next try.
    }
    this.plans = { at: Date.now(), names };
    return names;
  }

  /** Events from the union, with names, document titles and plan names filled in. */
  async hydrate(rows: EventRow[]): Promise<ActivityItem[]> {
    if (!rows.length) return [];
    const docIds = [
      ...new Set(
        rows
          .filter((r) => r.doc_id && r.type !== 'upload')
          .map((r) => r.doc_id!),
      ),
    ];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const [docs, users, plans] = await Promise.all([
      docIds.length
        ? select<{ id: string; title: string }>(
            `SELECT id, title FROM course_document WHERE id IN (:ids)`,
            { ids: docIds },
          )
        : Promise.resolve([]),
      select<{
        id: string;
        first_name: string;
        last_name: string;
        role: string;
      }>(
        `SELECT id, first_name, last_name, role FROM user WHERE id IN (:ids)`,
        { ids: userIds },
      ),
      rows.some((r) => r.type === 'purchase' && r.extra)
        ? this.planNames()
        : Promise.resolve(new Map<string, string>()),
    ]);
    const titles = new Map(docs.map((d) => [d.id, d.title]));
    const people = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => {
      const u = people.get(r.user_id);
      return {
        id: r.id,
        type: r.type,
        userId: r.user_id,
        userName: fullName(u?.first_name, u?.last_name, u?.role),
        detail: describeEvent(r, titles, plans),
        createdOn: iso(r.created_on)!,
      };
    });
  }

  private userQuery(params: UsersParams, onlineIds: string[] = []) {
    const now = Date.now();
    const replacements: Record<string, unknown> = {
      onlineIds,
      todayStart: startOfWatDay(),
      d7: new Date(now - 7 * 24 * 3600 * 1000),
      d30: new Date(now - 30 * 24 * 3600 * 1000),
    };
    const where: string[] = [];
    if (params.search?.trim()) {
      replacements.q = escapeLike(params.search);
      where.push(
        `(CONCAT(COALESCE(t.first_name,''), ' ', COALESCE(t.last_name,'')) LIKE :q OR t.email LIKE :q)`,
      );
    }
    const segment = SEGMENTS.includes(params.segment as Segment)
      ? (params.segment as Segment)
      : 'all';
    const segments: Record<Segment, string | null> = {
      all: null,
      online: onlineIds.length ? `t.id IN (:onlineIds)` : 'FALSE',
      active_today: `t.last_active >= :todayStart`,
      active_7d: `t.last_active >= :d7`,
      active_30d: `t.last_active >= :d30`,
      inactive_30d: `t.role = 'user' AND t.last_active < :d30`,
      never_used: `t.last_active IS NULL`,
    };
    if (segments[segment]) where.push(segments[segment]!);
    const plans: Record<string, string> = {
      free: `t.role = 'user' AND t.paid = 0`,
      paid: `t.paid = 1`,
      guest: `t.role = 'guest'`,
    };
    if (params.plan && plans[params.plan]) where.push(plans[params.plan]);
    if (params.joinedFrom || params.joinedTo) {
      const joined = parseRange(
        params.joinedFrom,
        params.joinedTo,
        new Date(),
        MAX_RANGE_DAYS,
      );
      replacements.joinedStart = joined.start;
      replacements.joinedEnd = joined.end;
      where.push(`t.created_on >= :joinedStart AND t.created_on < :joinedEnd`);
    }
    const inner = `
      SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.institution, u.created_on,
             p.last_seen_at, ${LAST_ACTIVE_SQL} AS last_active,
             CASE WHEN ${IS_PAID_SQL} THEN 1 ELSE 0 END AS paid,
             COALESCE(qf.n, 0) AS tests, COALESCE(df.n, 0) AS documents,
             COALESCE(scf.n, 0) AS finished, scf.avg AS avg_score,
             COALESCE(rrf.seconds, 0) AS reading
      FROM user u ${USER_FACTS_JOINS}`;
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const dir = params.dir === 'asc' ? 'ASC' : 'DESC';
    const sort = SORTS[params.sort as UserSort] ?? SORTS.last_active;
    // Empty values go last whichever way the column is sorted.
    const orderSql = `ORDER BY ${sort.map((c) => `${c} IS NULL, ${c} ${dir}`).join(', ')}, t.created_on DESC, t.id`;
    return { inner, whereSql, orderSql, replacements };
  }

  private toUserRow(r: any, online: Map<string, OnlinePerson>) {
    const role = r.role === 'guest' ? 'guest' : 'user';
    return {
      id: r.id,
      name: fullName(r.first_name, r.last_name, r.role),
      email: isGuestEmail(r.email) ? null : r.email,
      role,
      plan: role === 'guest' ? 'guest' : Number(r.paid) ? 'paid' : 'free',
      online: online.has(r.id),
      lastSeenAt: iso(r.last_active),
      createdOn: iso(r.created_on),
      documents: Number(r.documents),
      tests: Number(r.tests),
      testsFinished: Number(r.finished),
      averageScore:
        r.avg_score === null || r.avg_score === undefined
          ? null
          : Math.round(Number(r.avg_score)),
      /** Seconds read in Easy Read, all time. */
      readingSeconds: Number(r.reading ?? 0),
    };
  }

  async users(params: UsersParams) {
    const page = Math.max(1, Math.floor(Number(params.page)) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 25));
    const online = await this.onlinePeople();
    const { inner, whereSql, orderSql, replacements } = this.userQuery(params, [
      ...online.keys(),
    ]);

    const [rows, total, counts, paid, active30d] = await Promise.all([
      select(
        `SELECT * FROM (${inner}) t ${whereSql} ${orderSql} LIMIT :limit OFFSET :offset`,
        { ...replacements, limit: pageSize, offset: (page - 1) * pageSize },
      ),
      select<{ n: number }>(
        `SELECT COUNT(*) AS n FROM (${inner}) t ${whereSql}`,
        replacements,
      ),
      select<{ registered: number; guests: number }>(
        `SELECT SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) AS registered,
                SUM(CASE WHEN role = 'guest' THEN 1 ELSE 0 END) AS guests
         FROM user`,
      ),
      select<{ n: number }>(
        `SELECT COUNT(*) AS n FROM (SELECT user_id FROM subscriptions
           UNION SELECT user_id FROM one_time_subscription WHERE expires_on > UTC_TIMESTAMP()) x`,
      ),
      select<{ n: number }>(
        `SELECT COUNT(DISTINCT x.user_id) AS n FROM (${USAGE_ROWS_SQL}) x`,
        {
          aFrom: replacements.d30,
          aTo: new Date(),
          aFromDay: watDay(replacements.d30 as Date),
          aToDay: watDay(),
        },
      ),
    ]);

    return {
      total: Number(total[0]?.n ?? 0),
      page,
      pageSize,
      counts: {
        registered: Number(counts[0]?.registered ?? 0),
        guests: Number(counts[0]?.guests ?? 0),
        online: online.size,
        paid: Number(paid[0]?.n ?? 0),
        active30d: Number(active30d[0]?.n ?? 0),
      },
      users: rows.map((r) => this.toUserRow(r, online)),
    };
  }

  async usersCsv(params: UsersParams) {
    const online = await this.onlinePeople();
    const { inner, whereSql, orderSql, replacements } = this.userQuery(params, [
      ...online.keys(),
    ]);
    const rows = await select(
      `SELECT * FROM (${inner}) t ${whereSql} ${orderSql} LIMIT 50000`,
      replacements,
    );
    const lines = [
      [
        'Name',
        'Email',
        'Plan',
        'Last active',
        'Signed up',
        'Documents',
        'Tests made',
        'Tests finished',
        'Average score',
        'Easy Read minutes',
      ].join(','),
    ];
    for (const r of rows) {
      const u = this.toUserRow(r, online);
      lines.push(
        [
          u.name,
          u.email,
          u.plan,
          u.lastSeenAt,
          u.createdOn,
          u.documents,
          u.tests,
          u.testsFinished,
          u.averageScore,
          Math.round(u.readingSeconds / 60),
        ]
          .map(csvCell)
          .join(','),
      );
    }
    return lines.join('\n') + '\n';
  }

  /** One person's Easy Read time: totals and the documents they read longest. */
  private async readingSummary(
    reading: {
      document_id: string;
      s: number;
      sessions: number;
      last_at: Date | string;
    }[],
    thisMonth: { s: number }[],
  ) {
    const docs = reading.filter((r) => r.document_id);
    const top = docs.slice(0, 5);
    const titles = top.length
      ? new Map(
          (
            await select<{ id: string; title: string }>(
              `SELECT id, title FROM course_document WHERE id IN (:ids)`,
              { ids: top.map((r) => r.document_id) },
            )
          ).map((d) => [d.id, d.title]),
        )
      : new Map<string, string>();
    const lastReadAt = reading.reduce<string | null>((latest, r) => {
      const at = iso(r.last_at);
      return at && (!latest || at > latest) ? at : latest;
    }, null);
    return {
      seconds: reading.reduce((sum, r) => sum + Number(r.s), 0),
      secondsThisMonth: Number(thisMonth[0]?.s ?? 0),
      sessions: reading.reduce((sum, r) => sum + Number(r.sessions), 0),
      documents: docs.length,
      lastReadAt,
      top: top.map((r) => ({
        documentId: r.document_id,
        title: titles.get(r.document_id) ?? 'A deleted document',
        seconds: Number(r.s),
      })),
    };
  }

  async userDetail(id: string) {
    const month = new Date().toISOString().slice(0, 7);
    const recentReplacements: Record<string, unknown> = {};
    const recentSql = eventsUnion(
      { userIds: [id], limit: 60 },
      recentReplacements,
    )!;
    const yearAgo = new Date(Date.now() - 371 * 24 * 3600 * 1000);
    const [
      userRows,
      stats,
      recent,
      signIns,
      recurring,
      oneTime,
      online,
      reading,
      readingThisMonth,
      calendar,
    ] = await Promise.all([
      select(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.institution, u.created_on,
                u.email_confirmed,
                p.last_seen_at, p.doing, ${LAST_ACTIVE_SQL} AS last_active,
                CASE WHEN ${IS_PAID_SQL} THEN 1 ELSE 0 END AS paid,
                COALESCE(qf.n, 0) AS tests, COALESCE(df.n, 0) AS documents,
                ep.marketing_opt_out, ep.bounced
         FROM user u ${USER_FACTS_JOINS} WHERE u.id = :id`,
        { id },
      ),
      select(
        `SELECT
           (SELECT AVG(percentage_score) FROM score WHERE user_id = :id) AS avg_score,
           (SELECT seconds_used FROM easy_read_usage WHERE user_id = :id AND month = :month LIMIT 1) AS er_seconds,
           (SELECT COUNT(*) FROM oral_question_analysis o JOIN question q ON q.id = o.question_id WHERE q.user_id = :id) AS vivas,
           (SELECT COUNT(*) FROM document_message WHERE user_id = :id AND sender = 'user') AS chats,
           (SELECT remaining_time_ms + COALESCE(free_remaining_time_ms, 0) FROM call_credits WHERE user_id = :id LIMIT 1) AS call_ms`,
        { id, month },
      ),
      select<EventRow>(
        `SELECT * FROM (${recentSql}) e ORDER BY e.created_on DESC LIMIT 60`,
        recentReplacements,
      ),
      select(
        `SELECT created_on, meta FROM user_activity WHERE user_id = :id AND type = 'sign_in'
         ORDER BY created_on DESC LIMIT 5`,
        { id },
      ),
      select(
        `SELECT subscription_code FROM subscriptions WHERE user_id = :id ORDER BY created_on DESC LIMIT 1`,
        { id },
      ),
      select(
        `SELECT plan_code, expires_on FROM one_time_subscription WHERE user_id = :id AND expires_on > UTC_TIMESTAMP()
         ORDER BY expires_on DESC LIMIT 1`,
        { id },
      ),
      this.onlinePeople(),
      select<{
        document_id: string;
        s: number;
        sessions: number;
        last_at: Date | string;
      }>(
        `SELECT document_id, SUM(seconds) AS s, SUM(sessions) AS sessions, MAX(last_at) AS last_at
         FROM easy_read_reading WHERE user_id = :id GROUP BY document_id ORDER BY s DESC`,
        { id },
      ),
      select<{ s: number }>(
        `SELECT SUM(seconds) AS s FROM easy_read_reading WHERE user_id = :id AND day >= :monthStart`,
        { id, monthStart: `${watDay().slice(0, 7)}-01` },
      ),
      // Actions per WAT day over the last year, for the activity calendar.
      select<{ day: string; n: number }>(
        `SELECT DATE_FORMAT(DATE_ADD(x.at, INTERVAL 1 HOUR), '%Y-%m-%d') AS day, COUNT(*) AS n FROM (
             SELECT created_on AS at FROM question WHERE user_id = :id AND created_on >= :since
             UNION ALL SELECT created_on FROM course_document WHERE user_id = :id AND created_on >= :since
             UNION ALL SELECT created_on FROM score WHERE user_id = :id AND created_on >= :since
             UNION ALL SELECT created_on FROM document_message WHERE user_id = :id AND sender = 'user' AND created_on >= :since
             UNION ALL SELECT created_on FROM user_activity WHERE user_id = :id AND created_on >= :since
             UNION ALL SELECT last_at FROM easy_read_reading WHERE user_id = :id AND last_at >= :since
           ) x GROUP BY day`,
        { id, since: yearAgo },
      ),
    ]);
    const u = userRows[0];
    if (!u) throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    const s = stats[0] || {};

    let planName: string | null = null;
    if (recurring[0]?.subscription_code) {
      try {
        const sub = await Promise.race([
          this.paystack.fetchSubscriptionBySubscriptionCode(
            recurring[0].subscription_code,
          ),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
        ]);
        if (sub?.planInformation?.name) {
          const status = sub.subscrptionInformation?.status;
          planName =
            status && status !== 'active'
              ? `${sub.planInformation.name} (${status})`
              : sub.planInformation.name;
        }
      } catch {
        planName = null;
      }
    } else if (oneTime[0]) {
      const name = (await this.planNames()).get(oneTime[0].plan_code);
      planName = name ? `${name} (one-time)` : 'One-time plan';
    }

    const grouped = new Map<string, ActivityItem[]>();
    for (const item of await this.hydrate(recent)) {
      const day = watDay(new Date(item.createdOn));
      if (!grouped.has(day)) grouped.set(day, []);
      grouped.get(day)!.push(item);
    }
    const now = online.get(id);
    const role = u.role === 'guest' ? 'guest' : 'user';

    return {
      user: {
        id: u.id,
        firstName: u.first_name,
        lastName: u.last_name,
        email: isGuestEmail(u.email) ? null : u.email,
        institution: u.institution || null,
        role,
        plan: role === 'guest' ? 'guest' : Number(u.paid) ? 'paid' : 'free',
        planName,
        /** False while an email sign-up waits for its confirmation link to be opened. */
        emailConfirmed:
          u.email_confirmed === undefined ? true : !!Number(u.email_confirmed),
        createdOn: iso(u.created_on),
        online: !!now,
        doing: now?.doing ?? null,
        lastSeenAt: iso(u.last_active),
      },
      stats: {
        documents: Number(u.documents),
        tests: Number(u.tests),
        averageScore:
          s.avg_score === null || s.avg_score === undefined
            ? null
            : Math.round(Number(s.avg_score)),
        easyReadSecondsThisMonth: Number(s.er_seconds ?? 0),
        vivas: Number(s.vivas ?? 0),
        chatQuestions: Number(s.chats ?? 0),
      },
      marketing: {
        subscribed: !Number(u.marketing_opt_out) && !Number(u.bounced),
      },
      /** Oral viva minutes left (paid + free), or null when the person has no call credits row. */
      callCredits:
        s.call_ms === null || s.call_ms === undefined
          ? null
          : Math.floor(Number(s.call_ms) / 60000),
      days: [...grouped.entries()].map(([date, items]) => ({ date, items })),
      /** Easy Read reading time, recorded for every plan. */
      easyRead: await this.readingSummary(reading, readingThisMonth),
      /** Actions per day over the last year (days with none are left out). */
      calendar: calendar.map((r) => ({ day: r.day, count: Number(r.n) })),
      signIns: signIns.map((r) => {
        let device: string | null = null;
        try {
          device = r.meta ? (JSON.parse(r.meta).device ?? null) : null;
        } catch {
          device = null;
        }
        return { createdOn: iso(r.created_on), device };
      }),
    };
  }

  /** The people a search or a picked person narrows the activity to (undefined = everyone). */
  private async activityPeople(params: ActivityParams) {
    if (params.userId) return [params.userId];
    if (!params.search?.trim()) return undefined;
    const matches = await select<{ id: string }>(
      `SELECT id FROM user
       WHERE CONCAT(COALESCE(first_name,''), ' ', COALESCE(last_name,'')) LIKE :q OR email LIKE :q
       LIMIT 2000`,
      { q: escapeLike(params.search) },
    );
    return matches.map((m) => m.id);
  }

  private activityFilter(params: ActivityParams) {
    const range = parseRange(params.from, params.to, new Date(), 1);
    const types = String(params.types ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter((t): t is ActivityType =>
        ACTIVITY_TYPES.includes(t as ActivityType),
      );
    return { range, types: types.length ? types : undefined };
  }

  /** One page of everything people did, newest (or oldest) first, with real page numbers. */
  async activity(params: ActivityParams) {
    const pageSize = Math.min(100, Math.max(10, Number(params.pageSize) || 50));
    const order: 'asc' | 'desc' = params.sort === 'oldest' ? 'asc' : 'desc';
    const { range, types } = this.activityFilter(params);
    const userIds = await this.activityPeople(params);
    const base = { from: range.start, to: range.end, userIds, types };
    const empty = {
      total: 0,
      people: 0,
      page: 1,
      pageSize,
      items: [] as ActivityItem[],
    };

    const countReplacements: Record<string, unknown> = {};
    const countSql = eventsUnion({ ...base, lean: true }, countReplacements);
    if (!countSql) return empty;
    const key = `count|${range.from}|${range.to}|${(types ?? []).join(',')}|${(userIds ?? ['*']).join(',')}`;
    const [counts] = await this.remember(key, () =>
      select<{ n: number; people: number }>(
        `SELECT COUNT(*) AS n, COUNT(DISTINCT e.user_id) AS people FROM (${countSql}) e`,
        countReplacements,
      ),
    );
    const total = Number(counts?.n ?? 0);
    if (!total) return { ...empty, people: 0 };
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(
      pages,
      Math.max(1, Math.floor(Number(params.page)) || 1),
    );
    const offset = (page - 1) * pageSize;
    const size = Math.min(pageSize, total - offset);

    // Pages past the middle read from the other end, so the last page is as quick as the first.
    const fromEnd = offset > total / 2;
    const readOrder: 'asc' | 'desc' = fromEnd
      ? order === 'asc'
        ? 'desc'
        : 'asc'
      : order;
    const readOffset = fromEnd ? total - offset - size : offset;
    const pageReplacements: Record<string, unknown> = {};
    const pageSql = eventsUnion(
      { ...base, order: readOrder, limit: readOffset + size },
      pageReplacements,
    )!;
    const direction = readOrder === 'asc' ? 'ASC' : 'DESC';
    const rows = await select<EventRow>(
      `SELECT * FROM (${pageSql}) e ORDER BY e.created_on ${direction}, e.id ${direction}
       LIMIT :limit OFFSET :offset`,
      { ...pageReplacements, limit: size, offset: readOffset },
    );
    if (fromEnd) rows.reverse();
    return {
      total,
      people: Number(counts?.people ?? 0),
      page,
      pageSize,
      items: await this.hydrate(rows),
    };
  }

  /**
   * Counts of each kind (ignoring the kind filter, so the menu can show them) and the volume over
   * time, by hour for a day or two, by day up to four months, by week beyond.
   */
  async activitySummary(params: ActivityParams) {
    const { range } = this.activityFilter(params);
    const userIds = await this.activityPeople(params);
    const key = `summary|${range.from}|${range.to}|${(userIds ?? ['*']).join(',')}`;
    return this.remember(key, () => this.buildSummary(range, userIds));
  }

  private async buildSummary(range: DayRange, userIds: string[] | undefined) {
    const unit: 'hour' | 'day' | 'week' =
      range.days <= 2 ? 'hour' : range.days <= 120 ? 'day' : 'week';
    const seconds = unit === 'hour' ? 3600 : unit === 'day' ? 86400 : 7 * 86400;
    const count = Math.ceil(
      (range.end.getTime() - range.start.getTime()) / (seconds * 1000),
    );
    const buckets = Array.from({ length: count }, (_, i) => ({
      start: new Date(range.start.getTime() + i * seconds * 1000).toISOString(),
      counts: {} as Partial<Record<ActivityType, number>>,
    }));
    const byType = Object.fromEntries(
      ACTIVITY_TYPES.map((t) => [t, 0]),
    ) as Record<ActivityType, number>;
    const replacements: Record<string, unknown> = { hStart: range.start };
    const sql = eventsUnion(
      { from: range.start, to: range.end, userIds, lean: true },
      replacements,
    );
    if (sql) {
      const rows = await select<{ type: ActivityType; i: number; n: number }>(
        `SELECT e.type, FLOOR(TIMESTAMPDIFF(SECOND, :hStart, e.created_on) / ${seconds}) AS i, COUNT(*) AS n
         FROM (${sql}) e GROUP BY e.type, i`,
        replacements,
      );
      for (const r of rows) {
        const n = Number(r.n);
        if (byType[r.type] === undefined) continue;
        byType[r.type] += n;
        const bucket = buckets[Number(r.i)];
        if (bucket) bucket.counts[r.type] = (bucket.counts[r.type] ?? 0) + n;
      }
    }
    return {
      range: { from: range.from, to: range.to, days: range.days },
      byType,
      histogram: { unit, buckets },
    };
  }

  /** The filtered activity as CSV (newest first, up to 10,000 rows). */
  async activityCsv(params: ActivityParams) {
    const { range, types } = this.activityFilter(params);
    const userIds = await this.activityPeople(params);
    const replacements: Record<string, unknown> = {};
    const sql = eventsUnion(
      { from: range.start, to: range.end, userIds, types, limit: 10000 },
      replacements,
    );
    const rows = sql
      ? await select<EventRow>(
          `SELECT * FROM (${sql}) e ORDER BY e.created_on DESC, e.id DESC LIMIT 10000`,
          replacements,
        )
      : [];
    const items = await this.hydrate(rows);
    const lines = [['Time (WAT)', 'Person', 'Action', 'Details'].join(',')];
    for (const item of items) {
      const at = new Date(new Date(item.createdOn).getTime() + 3600 * 1000)
        .toISOString()
        .slice(0, 16)
        .replace('T', ' ');
      lines.push(
        [at, item.userName, item.type, item.detail].map(csvCell).join(','),
      );
    }
    return lines.join('\n') + '\n';
  }
}
