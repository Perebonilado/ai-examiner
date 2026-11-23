import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  ACTION_ROWS_SQL,
  COUNTED_ROWS_SQL,
  STUDY_HOURS_SQL,
  QUESTION_TYPE,
  USAGE_ROWS_SQL,
  bucketIndexOf,
  mondayOf,
  sqlWatMonday,
} from '../analytics';
import { EventRow, eventsUnion } from '../events';
import {
  DayRange,
  Granularity,
  allowedGranularities,
  bucketIndexSql,
  bucketsOf,
  parseRange,
  pickGranularity,
  previousRange,
  yearMonthOf,
} from '../range';
import { payments, warmPayments } from '../revenue';
import { fullName, initialsOf, select } from '../sql';
import { addDays, watDay, watDayStart } from '../time';
import { AdminStatsService } from './AdminStatsService';

export type MetricKey =
  | 'active'
  | 'signUps'
  | 'uploads'
  | 'testsMade'
  | 'testsFinished'
  | 'vivas'
  | 'chats'
  | 'payments'
  | 'revenue'
  | 'revenueUsd'
  | 'reading';

export interface Metric {
  total: number;
  previous: number;
  /** One value per bucket. */
  series: number[];
  /** One value per previous-period bucket. */
  previousSeries: number[];
}

/** Cached answers: the same range asked again within a minute is served from memory. */
const ANSWER_TTL_MS = 60 * 1000;
const MAX_CACHED = 40;
/** Who has ever uploaded / tested / paid: re-read every 10 minutes. */
const SETS_TTL_MS = 10 * 60 * 1000;
/** Retention: up to this many sign-up weeks, followed for this many weeks. */
const COHORT_WEEKS = 10;
const COHORT_SPAN = 8;

interface PeopleSets {
  uploaded: Set<string>;
  tested: Set<string>;
  finished: Set<string>;
  paid: Set<string>;
}

const num = (v: unknown) => Number(v ?? 0) || 0;

@Injectable()
export class AdminAnalyticsService implements OnModuleInit {
  private answers = new Map<string, { at: number; value: Promise<unknown> }>();
  private sets: { at: number; value: Promise<PeopleSets> } | null = null;

  constructor(@Inject(AdminStatsService) private stats: AdminStatsService) {}

  onModuleInit() {
    if (process.env.NODE_ENV !== 'test') warmPayments();
  }

  /** Everything on the overview for one date range, with the period before it to compare. */
  analytics(params: { from?: string; to?: string; granularity?: string }) {
    const range = parseRange(params.from, params.to);
    const granularity = pickGranularity(params.granularity, range.days);
    const key = `${range.from}|${range.to}|${granularity}`;
    const hit = this.answers.get(key);
    if (hit && Date.now() - hit.at < ANSWER_TTL_MS) return hit.value;
    const value = this.build(range, granularity).catch((err) => {
      this.answers.delete(key);
      throw err;
    });
    if (this.answers.size >= MAX_CACHED) this.answers.clear();
    this.answers.set(key, { at: Date.now(), value });
    return value;
  }

  private peopleSets(): Promise<PeopleSets> {
    if (this.sets && Date.now() - this.sets.at < SETS_TTL_MS)
      return this.sets.value;
    const ids = (rows: { user_id: string }[]) =>
      new Set(rows.map((r) => r.user_id));
    const value = Promise.all([
      select(`SELECT DISTINCT user_id FROM course_document`),
      select(`SELECT DISTINCT user_id FROM question`),
      select(`SELECT DISTINCT user_id FROM score`),
      select(
        `SELECT DISTINCT user_id FROM subscriptions UNION SELECT DISTINCT user_id FROM one_time_subscription`,
      ),
    ]).then(([uploaded, tested, finished, paid]) => ({
      uploaded: ids(uploaded),
      tested: ids(tested),
      finished: ids(finished),
      paid: ids(paid),
    }));
    value.catch(() => (this.sets = null));
    this.sets = { at: Date.now(), value };
    return value;
  }

  private async build(range: DayRange, granularity: Granularity) {
    const now = new Date();
    const prev = previousRange(range);
    const buckets = bucketsOf(range, granularity);
    const previousBuckets = bucketsOf(prev, granularity);

    // Both periods in one pass: a row belongs to the current period when it's on or after :start.
    const window = {
      aFrom: prev.start,
      aTo: range.end,
      aFromDay: prev.from,
      aToDay: range.to,
      start: range.start,
      prevStart: prev.start,
      startYm: yearMonthOf(range.from),
      prevStartYm: yearMonthOf(prev.from),
    };
    const current = {
      aFrom: range.start,
      aTo: range.end,
      aFromDay: range.from,
      aToDay: range.to,
    };
    const index = (column: string, g: Granularity) =>
      `CASE WHEN ${column} >= :start THEN ${bucketIndexSql(column, g, 'start')}
            ELSE ${bucketIndexSql(column, g, 'prevStart')} END`;

    // Cohorts: sign-up weeks that start inside the range, the latest few.
    const lastMonday = mondayOf(range.to);
    let firstMonday = mondayOf(range.from);
    if (firstMonday < range.from) firstMonday = addDays(firstMonday, 7);
    const earliest = addDays(lastMonday, -7 * (COHORT_WEEKS - 1));
    if (firstMonday < earliest) firstMonday = earliest;
    const cohortStart = watDayStart(firstMonday);
    const cohortEnd = watDayStart(addDays(lastMonday, 7));
    const hasCohorts = firstMonday <= lastMonday;

    const [
      activeBuckets,
      activeDays,
      activeTotals,
      counted,
      easyReadDocs,
      heat,
      scoreBuckets,
      signUpIds,
      cohortSizes,
      cohortActivity,
      top,
      sets,
      paid,
      readingDays,
      readingTotals,
      readingDocs,
      readingPeople,
      readingSince,
    ] = await Promise.all([
      select<{ cur: number; i: number; n: number }>(
        `SELECT (x.at >= :start) AS cur, ${index('x.at', granularity)} AS i, COUNT(DISTINCT x.user_id) AS n
         FROM (${USAGE_ROWS_SQL}) x GROUP BY cur, i`,
        window,
      ),
      granularity === 'day'
        ? Promise.resolve(null)
        : select<{ cur: number; i: number; n: number }>(
            `SELECT (x.at >= :start) AS cur, ${index('x.at', 'day')} AS i, COUNT(DISTINCT x.user_id) AS n
             FROM (${USAGE_ROWS_SQL}) x GROUP BY cur, i`,
            window,
          ),
      select<{ cur: number; prev: number }>(
        `SELECT COUNT(DISTINCT CASE WHEN x.at >= :start THEN x.user_id END) AS cur,
                COUNT(DISTINCT CASE WHEN x.at < :start THEN x.user_id END) AS prev
         FROM (${USAGE_ROWS_SQL}) x`,
        window,
      ),
      select<{ kind: string; cur: number; i: number; n: number; s: number }>(
        `SELECT x.kind, (x.at >= :start) AS cur, ${index('x.at', granularity)} AS i, COUNT(*) AS n, SUM(x.val) AS s
         FROM (${COUNTED_ROWS_SQL}) x GROUP BY x.kind, cur, i`,
        window,
      ),
      select<{ cur: number; n: number }>(
        `SELECT (created_on >= :start) AS cur, COUNT(DISTINCT document_id) AS n FROM simplified_page
         WHERE created_on >= :aFrom AND created_on < :aTo GROUP BY cur`,
        window,
      ),
      // Students studying in each weekday hour, added up over the range.
      select<{ d: number; h: number; n: number }>(
        `SELECT WEEKDAY(x.day) AS d, x.hour AS h, COUNT(DISTINCT x.user_id, x.day, x.hour) AS n
         FROM (${STUDY_HOURS_SQL}) x GROUP BY d, h`,
        current,
      ),
      select<{ b: number; n: number }>(
        `SELECT LEAST(10, GREATEST(0, FLOOR(percentage_score / 10))) AS b, COUNT(*) AS n FROM score
         WHERE created_on >= :aFrom AND created_on < :aTo GROUP BY b`,
        current,
      ),
      select<{ id: string }>(
        `SELECT id FROM user WHERE role = 'user' AND created_on >= :aFrom AND created_on < :aTo`,
        current,
      ),
      hasCohorts
        ? select<{ wk: string; n: number }>(
            `SELECT ${sqlWatMonday('created_on')} AS wk, COUNT(*) AS n FROM user
             WHERE role = 'user' AND created_on >= :cStart AND created_on < :cEnd GROUP BY wk`,
            { cStart: cohortStart, cEnd: cohortEnd },
          )
        : Promise.resolve([]),
      hasCohorts
        ? select<{ wk: string; w: number; n: number }>(
            `SELECT c.wk, FLOOR(TIMESTAMPDIFF(SECOND, c.created_on, a.at) / 604800) AS w, COUNT(DISTINCT c.id) AS n
             FROM (SELECT id, created_on, ${sqlWatMonday('created_on')} AS wk FROM user
                   WHERE role = 'user' AND created_on >= :cStart AND created_on < :cEnd) c
             JOIN (${USAGE_ROWS_SQL}) a ON a.user_id = c.id AND a.at >= c.created_on
             GROUP BY c.wk, w HAVING w < ${COHORT_SPAN}`,
            {
              cStart: cohortStart,
              cEnd: cohortEnd,
              aFrom: cohortStart,
              aTo: now,
              aFromDay: firstMonday,
              aToDay: watDay(now),
            },
          )
        : Promise.resolve([]),
      select<{
        user_id: string;
        n: number;
        tests: number;
        uploads: number;
        finished: number;
        chats: number;
        read_days: number;
        reading: number;
      }>(
        `SELECT x.user_id, COUNT(*) AS n, SUM(x.kind = 'test') AS tests, SUM(x.kind = 'upload') AS uploads,
                SUM(x.kind = 'finished') AS finished, SUM(x.kind = 'chat') AS chats,
                SUM(x.kind = 'easy_read') AS read_days, SUM(x.secs) AS reading
         FROM (${ACTION_ROWS_SQL}) x GROUP BY x.user_id ORDER BY n DESC LIMIT 8`,
        current,
      ),
      this.peopleSets(),
      payments(),
      // Easy Read reading time (recorded per person, document and WAT day).
      select<{ day: string; s: number }>(
        `SELECT day, SUM(seconds) AS s FROM easy_read_reading
         WHERE day >= :fromDay AND day <= :toDay GROUP BY day`,
        { fromDay: prev.from, toDay: range.to },
      ),
      select<{ cur: number; readers: number; s: number; sessions: number }>(
        `SELECT (day >= :curDay) AS cur, COUNT(DISTINCT user_id) AS readers, SUM(seconds) AS s,
                SUM(sessions) AS sessions
         FROM easy_read_reading WHERE day >= :fromDay AND day <= :toDay GROUP BY cur`,
        { curDay: range.from, fromDay: prev.from, toDay: range.to },
      ),
      select<{ document_id: string; s: number; readers: number }>(
        `SELECT document_id, SUM(seconds) AS s, COUNT(DISTINCT user_id) AS readers FROM easy_read_reading
         WHERE day >= :fromDay AND day <= :toDay AND document_id <> ''
         GROUP BY document_id ORDER BY s DESC LIMIT 6`,
        { fromDay: range.from, toDay: range.to },
      ),
      select<{ user_id: string; s: number; docs: number; days: number }>(
        `SELECT user_id, SUM(seconds) AS s, COUNT(DISTINCT NULLIF(document_id, '')) AS docs,
                COUNT(DISTINCT day) AS days
         FROM easy_read_reading WHERE day >= :fromDay AND day <= :toDay
         GROUP BY user_id ORDER BY s DESC LIMIT 6`,
        { fromDay: range.from, toDay: range.to },
      ),
      select<{ d: string | null }>(
        `SELECT MIN(day) AS d FROM easy_read_reading`,
      ),
    ]);

    /* ----- Series ----- */

    const blank = (): Metric => ({
      total: 0,
      previous: 0,
      series: buckets.map(() => 0),
      previousSeries: previousBuckets.map(() => 0),
    });
    const metrics: Record<MetricKey, Metric> = {
      active: blank(),
      signUps: blank(),
      uploads: blank(),
      testsMade: blank(),
      testsFinished: blank(),
      vivas: blank(),
      chats: blank(),
      payments: blank(),
      revenue: blank(),
      revenueUsd: blank(),
      reading: blank(),
    };
    const add = (metric: Metric, cur: boolean, i: number, n: number) => {
      const list = cur ? metric.series : metric.previousSeries;
      if (i < 0 || i >= list.length) return;
      list[i] += n;
      if (cur) metric.total += n;
      else metric.previous += n;
    };

    for (const r of activeBuckets) {
      const list = num(r.cur)
        ? metrics.active.series
        : metrics.active.previousSeries;
      const i = num(r.i);
      if (i >= 0 && i < list.length) list[i] = num(r.n);
    }
    metrics.active.total = num(activeTotals[0]?.cur);
    metrics.active.previous = num(activeTotals[0]?.prev);

    // Average a day: from the day points themselves, or a separate day count.
    const dailySums = { cur: 0, prev: 0 };
    for (const r of activeDays ?? activeBuckets) {
      if (num(r.cur)) dailySums.cur += num(r.n);
      else dailySums.prev += num(r.n);
    }

    const counts: Record<
      string,
      { cur: number; prev: number; sum: number; prevSum: number }
    > = {};
    const QUESTION_KIND = new Map<string, MetricKey>([
      [`q${QUESTION_TYPE.multipleChoice}`, 'testsMade'],
      [`q${QUESTION_TYPE.flashcards}`, 'testsMade'],
      [`q${QUESTION_TYPE.trueFalse}`, 'testsMade'],
      [`q${QUESTION_TYPE.essay}`, 'testsMade'],
      [`q${QUESTION_TYPE.viva}`, 'vivas'],
    ]);
    const METRIC_OF: Record<string, MetricKey> = {
      sign_up_google: 'signUps',
      sign_up_email: 'signUps',
      upload: 'uploads',
      test_finished: 'testsFinished',
      chat: 'chats',
    };
    for (const r of counted) {
      const cur = !!num(r.cur);
      const n = num(r.n);
      const c = (counts[r.kind] ??= { cur: 0, prev: 0, sum: 0, prevSum: 0 });
      if (cur) {
        c.cur += n;
        c.sum += num(r.s);
      } else {
        c.prev += n;
        c.prevSum += num(r.s);
      }
      const metric = METRIC_OF[r.kind] ?? QUESTION_KIND.get(r.kind);
      if (metric) add(metrics[metric], cur, num(r.i), n);
    }
    const count = (kind: string) =>
      counts[kind] ?? { cur: 0, prev: 0, sum: 0, prevSum: 0 };

    for (const r of readingDays) {
      const cur = r.day >= range.from;
      add(
        metrics.reading,
        cur,
        bucketIndexOf(cur ? buckets : previousBuckets, r.day),
        num(r.s),
      );
    }

    let revenueAvailable = false;
    if (paid) {
      revenueAvailable = true;
      for (const p of paid) {
        if (p.at < prev.start || p.at >= range.end) continue;
        const day = watDay(p.at);
        const cur = p.at >= range.start;
        const i = bucketIndexOf(cur ? buckets : previousBuckets, day);
        add(metrics.payments, cur, i, 1);
        if (p.currency === 'USD') add(metrics.revenueUsd, cur, i, p.amount);
        else if (p.currency === 'NGN') add(metrics.revenue, cur, i, p.amount);
      }
    }

    /* ----- Funnel: what this period's sign-ups went on to do (so far) ----- */

    const ids = signUpIds.map((r) => r.id);
    const has = (set: Set<string>) => ids.filter((id) => set.has(id)).length;
    const funnel = [
      { key: 'signed_up', label: 'Signed up', count: ids.length },
      {
        key: 'uploaded',
        label: 'Uploaded a document',
        count: has(sets.uploaded),
      },
      { key: 'tested', label: 'Made a test', count: has(sets.tested) },
      { key: 'finished', label: 'Finished a test', count: has(sets.finished) },
      { key: 'paid', label: 'Paid', count: has(sets.paid) },
    ];

    /* ----- Retention: of each sign-up week, the share back in each week after ----- */

    const today = watDay(now);
    const activity = new Map<string, number[]>();
    for (const r of cohortActivity) {
      const weeks = activity.get(r.wk) ?? Array(COHORT_SPAN).fill(0);
      const w = num(r.w);
      if (w >= 0 && w < COHORT_SPAN) weeks[w] = num(r.n);
      activity.set(r.wk, weeks);
    }
    const sizes = new Map(cohortSizes.map((r) => [r.wk, num(r.n)]));
    const cohorts: { week: string; size: number; weeks: (number | null)[] }[] =
      [];
    if (hasCohorts) {
      for (let wk = firstMonday; wk <= lastMonday; wk = addDays(wk, 7)) {
        const weeks = activity.get(wk) ?? Array(COHORT_SPAN).fill(0);
        cohorts.push({
          week: wk,
          size: sizes.get(wk) ?? 0,
          // A week that hasn't started yet for anyone in the cohort has no value.
          weeks: weeks.map((n, w) => (addDays(wk, 7 * w) <= today ? n : null)),
        });
      }
    }

    /* ----- Mix, heatmap, scores, top students ----- */

    const pair = (kind: string) => ({
      count: count(kind).cur,
      previous: count(kind).prev,
    });
    const features = [
      {
        key: 'multiple_choice',
        label: 'Multiple choice tests',
        ...pair(`q${QUESTION_TYPE.multipleChoice}`),
      },
      {
        key: 'flashcards',
        label: 'Flashcard sets',
        ...pair(`q${QUESTION_TYPE.flashcards}`),
      },
      {
        key: 'true_false',
        label: 'True/false tests',
        ...pair(`q${QUESTION_TYPE.trueFalse}`),
      },
      {
        key: 'essay',
        label: 'Essay questions',
        ...pair(`q${QUESTION_TYPE.essay}`),
      },
      { key: 'viva', label: 'Oral vivas', ...pair(`q${QUESTION_TYPE.viva}`) },
      { key: 'chat', label: 'Chat questions', ...pair('chat') },
      { key: 'summary', label: 'Summaries', ...pair('summary') },
      {
        key: 'easy_read_sessions',
        label: 'Easy Read sessions',
        count: num(readingTotals.find((r) => num(r.cur))?.sessions),
        previous: num(readingTotals.find((r) => !num(r.cur))?.sessions),
      },
      {
        key: 'easy_read',
        label: 'Documents in Easy Read',
        count: num(easyReadDocs.find((r) => num(r.cur))?.n),
        previous: num(easyReadDocs.find((r) => !num(r.cur))?.n),
      },
    ];

    const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const r of heat) {
      const d = num(r.d);
      const h = num(r.h);
      if (d >= 0 && d < 7 && h >= 0 && h < 24) heatmap[d][h] = num(r.n);
    }

    const scoreCounts = Array(11).fill(0);
    for (const r of scoreBuckets)
      scoreCounts[Math.min(10, Math.max(0, num(r.b)))] += num(r.n);
    const finished = count('test_finished');
    const scored = scoreCounts.reduce((a, b) => a + b, 0);

    const peopleIds = [
      ...new Set([
        ...top.map((t) => t.user_id),
        ...readingPeople.map((r) => r.user_id),
      ]),
    ];
    const [names, docTitles] = await Promise.all([
      peopleIds.length
        ? select<{
            id: string;
            first_name: string;
            last_name: string;
            role: string;
          }>(
            `SELECT id, first_name, last_name, role FROM user WHERE id IN (:ids)`,
            {
              ids: peopleIds,
            },
          )
        : Promise.resolve([]),
      readingDocs.length
        ? select<{ id: string; title: string }>(
            `SELECT id, title FROM course_document WHERE id IN (:ids)`,
            { ids: readingDocs.map((d) => d.document_id) },
          )
        : Promise.resolve([]),
    ]);
    const byId = new Map(names.map((u) => [u.id, u]));
    const titles = new Map(docTitles.map((d) => [d.id, d.title]));
    const person = (id: string) => {
      const u = byId.get(id);
      const name = fullName(u?.first_name, u?.last_name, u?.role);
      return { name, initials: u?.role === 'guest' ? 'G' : initialsOf(name) };
    };
    const readingCur = readingTotals.find((r) => num(r.cur));
    const readingPrev = readingTotals.find((r) => !num(r.cur));

    const signUps = count('sign_up_google').cur + count('sign_up_email').cur;
    return {
      generatedAt: now.toISOString(),
      range: { from: range.from, to: range.to, days: range.days },
      previous: { from: prev.from, to: prev.to, days: prev.days },
      granularity,
      granularities: allowedGranularities(range.days),
      buckets,
      previousBuckets,
      metrics,
      extras: {
        averageDailyActive: Math.round((dailySums.cur / range.days) * 10) / 10,
        previousAverageDailyActive:
          Math.round((dailySums.prev / prev.days) * 10) / 10,
        googleSignUps: count('sign_up_google').cur,
        signUps,
        guests: count('guest').cur,
        averageScore: finished.cur
          ? Math.round((finished.sum / finished.cur) * 10) / 10
          : null,
        previousAverageScore: finished.prev
          ? Math.round((finished.prevSum / finished.prev) * 10) / 10
          : null,
        passRate: scored
          ? Math.round(
              (scoreCounts.slice(5).reduce((a, b) => a + b, 0) / scored) * 1000,
            ) / 10
          : null,
        signIns: count('sign_in').cur,
        easyReadOpens: count('easy_read').cur,
        vivasFinished: count('viva_finished').cur,
        revenueAvailable,
      },
      funnel,
      cohorts,
      features,
      heatmap,
      scores: { buckets: scoreCounts, count: scored },
      easyRead: {
        /** The first day reading time was recorded (null before any). */
        since: readingSince[0]?.d ?? null,
        readers: num(readingCur?.readers),
        previousReaders: num(readingPrev?.readers),
        sessions: num(readingCur?.sessions),
        previousSessions: num(readingPrev?.sessions),
        documents: readingDocs.map((d) => ({
          documentId: d.document_id,
          title: titles.get(d.document_id) ?? 'A deleted document',
          seconds: num(d.s),
          readers: num(d.readers),
        })),
        topReaders: readingPeople.map((r) => ({
          userId: r.user_id,
          ...person(r.user_id),
          seconds: num(r.s),
          documents: num(r.docs),
          days: num(r.days),
        })),
      },
      topStudents: top.map((t) => {
        const u = byId.get(t.user_id);
        const name = fullName(u?.first_name, u?.last_name, u?.role);
        return {
          userId: t.user_id,
          name,
          initials: u?.role === 'guest' ? 'G' : initialsOf(name),
          actions: num(t.n),
          tests: num(t.tests),
          uploads: num(t.uploads),
          finished: num(t.finished),
          chats: num(t.chats),
          /** Documents read in Easy Read (one per document per day) and the seconds spent. */
          reads: num(t.read_days),
          readingSeconds: num(t.reading),
        };
      }),
    };
  }

  /** Right now: who is online and doing what, today's count so far, and the latest actions. */
  async live() {
    const now = new Date();
    const today = watDay(now);
    const feedReplacements: Record<string, unknown> = {};
    const feedSql = eventsUnion(
      { from: watDayStart(addDays(today, -6)), limit: 12 },
      feedReplacements,
    )!;
    const [online, activeToday, signUpsToday, feedRows] = await Promise.all([
      this.stats.onlinePeople(now),
      select<{ n: number }>(
        `SELECT COUNT(DISTINCT x.user_id) AS n FROM (${USAGE_ROWS_SQL}) x`,
        { aFrom: watDayStart(today), aTo: now, aFromDay: today, aToDay: today },
      ),
      select<{ n: number }>(
        `SELECT COUNT(*) AS n FROM user WHERE role = 'user' AND created_on >= :from`,
        { from: watDayStart(today) },
      ),
      select<EventRow>(
        `SELECT * FROM (${feedSql}) e ORDER BY e.created_on DESC LIMIT 12`,
        feedReplacements,
      ),
    ]);
    const people = [...online.values()].sort(
      (a, b) => b.lastAt.getTime() - a.lastAt.getTime(),
    );
    const shown = people.slice(0, 30);
    const [feed, users] = await Promise.all([
      this.stats.hydrate(feedRows),
      shown.length
        ? select<{
            id: string;
            first_name: string;
            last_name: string;
            role: string;
          }>(
            `SELECT id, first_name, last_name, role FROM user WHERE id IN (:ids)`,
            { ids: shown.map((p) => p.userId) },
          )
        : Promise.resolve([]),
    ]);
    const names = new Map(users.map((u) => [u.id, u]));
    return {
      generatedAt: now.toISOString(),
      onlineNow: online.size,
      readingNow: people.filter((p) =>
        p.doing?.startsWith('Reading in Easy Read'),
      ).length,
      activeToday: num(activeToday[0]?.n),
      signUpsToday: num(signUpsToday[0]?.n),
      online: shown.map((p) => {
        const u = names.get(p.userId);
        const name = fullName(u?.first_name, u?.last_name, u?.role);
        return {
          userId: p.userId,
          name,
          initials: u?.role === 'guest' ? 'G' : initialsOf(name),
          doing: p.doing,
          since: p.since.toISOString(),
          lastSeenAt: p.lastAt.toISOString(),
        };
      }),
      feed,
    };
  }
}
