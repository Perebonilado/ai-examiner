import { ACTIVITY_TYPES, ActivityType } from './models/ActivityModels';
import { RECENT_ACTION_MS } from './sql';

/**
 * Everything people do, read from the tables the app already writes as they use it (tests,
 * uploads, chats, scores, vivas, plans, sign-ups), so the admin shows real activity for the whole
 * live site, history included. Only sign-ins and Easy Read opens come from `user_activity`,
 * because nothing else records them.
 */

/** Question types from the `lookup` table (ids are fixed there). */
const QUESTION_KINDS: Record<number, string> = {
  3: 'multiple choice questions',
  4: 'flashcards',
  5: 'true/false questions',
  7: 'essay questions',
};
/** Lookup id of "Oral (Viva)": these question sets are vivas, not tests. */
const ORAL_TYPE_ID = 6;

const ACTIVITY_TYPE_SET = new Set<ActivityType>(ACTIVITY_TYPES);

/** The only kinds still read from `user_activity`. */
export const TRACKED_TYPES: ActivityType[] = ['sign_in'];

export interface EventFilter {
  /** created_on >= from */
  from?: Date;
  /** created_on < to */
  to?: Date;
  /** created_on < before (paging) */
  before?: Date;
  /** Only these people. An empty list matches nobody. */
  userIds?: string[];
  /** Only these kinds (none or empty = every kind). */
  types?: ActivityType[];
  /** First N from each source in `order` (the outer query sorts and limits again). */
  limit?: number;
  /** Newest first (default) or oldest first. */
  order?: 'desc' | 'asc';
  /** Only type, user_id and created_on (much quicker to count over long ranges). */
  lean?: boolean;
}

/** One row of the union. `num` and `extra` mean different things per source (see describeEvent). */
export interface EventRow {
  id: string;
  type: ActivityType;
  user_id: string;
  created_on: Date | string;
  doc_id: string | null;
  num: number | null;
  extra: string | null;
}

interface Source {
  types: ActivityType[];
  /** Narrows a source that produces several types to the wanted ones. */
  typeCondition?: (types: ActivityType[]) => string;
  date: string;
  user: string;
  where?: string;
  /** SELECT … FROM … giving id, type, user_id, created_on, doc_id, num, extra. */
  select: string;
  /** SELECT … FROM … giving only type, user_id, created_on: for counting. */
  lean: string;
}

const SOURCES: Source[] = [
  {
    types: ['sign_up'],
    date: 'u.created_on',
    user: 'u.id',
    where: `u.role = 'user'`,
    // Google sign-ups are created with an empty password.
    select: `SELECT CONCAT('u:', u.id) AS id, 'sign_up' AS type, u.id AS user_id, u.created_on AS created_on,
      NULL AS doc_id, NULL AS num, CASE WHEN u.password IS NULL OR u.password = '' THEN 'google' ELSE 'email' END AS extra
      FROM user u`,
    lean: `SELECT 'sign_up' AS type, u.id AS user_id, u.created_on AS created_on FROM user u`,
  },
  {
    types: ['upload'],
    date: 'd.created_on',
    user: 'd.user_id',
    select: `SELECT CONCAT('d:', d.id) AS id, 'upload' AS type, d.user_id AS user_id, d.created_on AS created_on,
      d.id AS doc_id, NULL AS num, d.title AS extra
      FROM course_document d`,
    lean: `SELECT 'upload' AS type, d.user_id AS user_id, d.created_on AS created_on FROM course_document d`,
  },
  {
    types: ['test_generated', 'viva'],
    typeCondition: (types) =>
      types.includes('viva')
        ? `q.question_type_id = ${ORAL_TYPE_ID}`
        : `q.question_type_id <> ${ORAL_TYPE_ID}`,
    date: 'q.created_on',
    user: 'q.user_id',
    select: `SELECT CONCAT('q:', q.id) AS id,
      CASE WHEN q.question_type_id = ${ORAL_TYPE_ID} THEN 'viva' ELSE 'test_generated' END AS type,
      q.user_id AS user_id, q.created_on AS created_on, q.course_document_id AS doc_id, q.question_type_id AS num,
      CASE WHEN q.question_type_id = ${ORAL_TYPE_ID} THEN 'started' ELSE NULL END AS extra
      FROM question q`,
    lean: `SELECT CASE WHEN q.question_type_id = ${ORAL_TYPE_ID} THEN 'viva' ELSE 'test_generated' END AS type,
      q.user_id AS user_id, q.created_on AS created_on FROM question q`,
  },
  {
    types: ['test_finished'],
    date: 's.created_on',
    user: 's.user_id',
    select: `SELECT CONCAT('s:', s.id) AS id, 'test_finished' AS type, s.user_id AS user_id, s.created_on AS created_on,
      s.document_id AS doc_id, s.percentage_score AS num, NULL AS extra
      FROM score s`,
    lean: `SELECT 'test_finished' AS type, s.user_id AS user_id, s.created_on AS created_on FROM score s`,
  },
  {
    types: ['chat'],
    date: 'm.created_on',
    user: 'm.user_id',
    where: `m.sender = 'user'`,
    select: `SELECT CONCAT('m:', m.id) AS id, 'chat' AS type, m.user_id AS user_id, m.created_on AS created_on,
      m.course_document_id AS doc_id, NULL AS num, NULL AS extra
      FROM document_message m`,
    lean: `SELECT 'chat' AS type, m.user_id AS user_id, m.created_on AS created_on FROM document_message m`,
  },
  {
    types: ['viva'],
    date: 'o.created_on',
    user: 'oq.user_id',
    select: `SELECT CONCAT('v:', o.id) AS id, 'viva' AS type, oq.user_id AS user_id, o.created_on AS created_on,
      oq.course_document_id AS doc_id, NULL AS num, 'finished' AS extra
      FROM oral_question_analysis o JOIN question oq ON oq.id = o.question_id`,
    lean: `SELECT 'viva' AS type, oq.user_id AS user_id, o.created_on AS created_on
      FROM oral_question_analysis o JOIN question oq ON oq.id = o.question_id`,
  },
  {
    types: ['purchase'],
    date: 'sb.created_on',
    user: 'sb.user_id',
    select: `SELECT CONCAT('p:', sb.id) AS id, 'purchase' AS type, sb.user_id AS user_id, sb.created_on AS created_on,
      NULL AS doc_id, NULL AS num, NULL AS extra
      FROM subscriptions sb`,
    lean: `SELECT 'purchase' AS type, sb.user_id AS user_id, sb.created_on AS created_on FROM subscriptions sb`,
  },
  {
    types: ['purchase'],
    date: 'ot.created_on',
    user: 'ot.user_id',
    select: `SELECT CONCAT('o:', ot.id) AS id, 'purchase' AS type, ot.user_id AS user_id, ot.created_on AS created_on,
      NULL AS doc_id, NULL AS num, ot.plan_code AS extra
      FROM one_time_subscription ot`,
    lean: `SELECT 'purchase' AS type, ot.user_id AS user_id, ot.created_on AS created_on FROM one_time_subscription ot`,
  },
  {
    types: TRACKED_TYPES,
    typeCondition: (types) =>
      `a.type IN (${types.map((t) => `'${t}'`).join(', ')})`,
    date: 'a.created_on',
    user: 'a.user_id',
    where: `a.type IN (${TRACKED_TYPES.map((t) => `'${t}'`).join(', ')})`,
    select: `SELECT a.id AS id, a.type AS type, a.user_id AS user_id, a.created_on AS created_on,
      NULL AS doc_id, NULL AS num, a.detail AS extra
      FROM user_activity a`,
    lean: `SELECT a.type AS type, a.user_id AS user_id, a.created_on AS created_on FROM user_activity a`,
  },
  {
    // Easy Read: one entry per document read per day, timed at the last report, with the seconds.
    types: ['easy_read'],
    date: 'r.last_at',
    user: 'r.user_id',
    select: `SELECT CONCAT('r:', r.id) AS id, 'easy_read' AS type, r.user_id AS user_id, r.last_at AS created_on,
      NULLIF(r.document_id, '') AS doc_id, r.seconds AS num, NULL AS extra
      FROM easy_read_reading r`,
    lean: `SELECT 'easy_read' AS type, r.user_id AS user_id, r.last_at AS created_on FROM easy_read_reading r`,
  },
];

/**
 * A UNION ALL of every source that can match the filter, or null when nothing can (an empty
 * people list). Adds its replacements to `replacements`. Each branch filters on its own date
 * column so it uses that table's (created_on) index.
 */
export function eventsUnion(
  filter: EventFilter,
  replacements: Record<string, unknown>,
): string | null {
  if (filter.userIds && filter.userIds.length === 0) return null;
  const wanted = filter.types?.length
    ? filter.types.filter((t) => ACTIVITY_TYPE_SET.has(t))
    : null;
  if (wanted && !wanted.length) return null;
  const direction = filter.order === 'asc' ? 'ASC' : 'DESC';
  const parts: string[] = [];
  for (const source of SOURCES) {
    const matching = wanted
      ? source.types.filter((t) => wanted.includes(t))
      : source.types;
    if (!matching.length) continue;
    const where: string[] = [];
    if (source.where) where.push(source.where);
    // Only narrow a mixed source when some of its kinds are left out.
    if (source.typeCondition && matching.length < source.types.length)
      where.push(source.typeCondition(matching));
    if (filter.from) where.push(`${source.date} >= :evFrom`);
    if (filter.to) where.push(`${source.date} < :evTo`);
    if (filter.before) where.push(`${source.date} < :evBefore`);
    if (filter.userIds) where.push(`${source.user} IN (:evUsers)`);
    const order = filter.limit
      ? ` ORDER BY ${source.date} ${direction} LIMIT ${Math.floor(filter.limit)}`
      : '';
    parts.push(
      `(${filter.lean ? source.lean : source.select}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}${order})`,
    );
  }
  if (!parts.length) return null;
  if (filter.from) replacements.evFrom = filter.from;
  if (filter.to) replacements.evTo = filter.to;
  if (filter.before) replacements.evBefore = filter.before;
  if (filter.userIds) replacements.evUsers = filter.userIds;
  return parts.join('\nUNION ALL\n');
}

/**
 * Signs of use in the last hour (needs :onlineSince and :sessionSince): heartbeats, plus actions
 * the app's own tables record, so people using the live site show up even without a heartbeat.
 */
export const RECENT_SIGNALS_SQL = `
  SELECT user_id, 'presence' AS kind, last_seen_at AS at, doing, session_started_at FROM user_presence
    WHERE last_seen_at >= :onlineSince
  UNION ALL SELECT user_id, CASE WHEN question_type_id = ${ORAL_TYPE_ID} THEN 'viva' ELSE 'test_generated' END,
    created_on, NULL, NULL FROM question WHERE created_on >= :sessionSince
  UNION ALL SELECT user_id, 'upload', created_on, NULL, NULL FROM course_document WHERE created_on >= :sessionSince
  UNION ALL SELECT user_id, 'test_finished', created_on, NULL, NULL FROM score WHERE created_on >= :sessionSince
  UNION ALL SELECT user_id, 'answering', modified_on, NULL, NULL FROM question_progress WHERE modified_on >= :sessionSince
  UNION ALL SELECT user_id, 'chat', created_on, NULL, NULL FROM document_message WHERE created_on >= :sessionSince
  UNION ALL SELECT user_id, 'easy_read', last_active_on, NULL, NULL FROM easy_read_usage WHERE last_active_on >= :sessionSince
  UNION ALL SELECT user_id, 'easy_read', last_at, NULL, NULL FROM easy_read_reading WHERE last_at >= :sessionSince
  UNION ALL SELECT user_id, type, created_on, NULL, NULL FROM user_activity WHERE created_on >= :sessionSince`;

/** How far back a session can start for someone shown online. */
export const SESSION_LOOKBACK_MS = 60 * 60 * 1000;

const DOING: Record<string, string> = {
  easy_read: 'Reading in Easy Read',
  answering: 'Taking a test',
  test_finished: 'Taking a test',
  test_generated: 'Making a test',
  viva: 'In an oral viva',
  upload: 'Uploading a document',
  chat: 'Chatting with a document',
  sign_in: 'Just signed in',
};

export interface SignalRow {
  user_id: string;
  kind: string;
  at: Date | string;
  doing: string | null;
  session_started_at: Date | string | null;
}

export interface OnlinePerson {
  userId: string;
  doing: string | null;
  since: Date;
  lastAt: Date;
}

const toDate = (value: Date | string) =>
  value instanceof Date
    ? value
    : new Date(String(value).replace(' ', 'T') + 'Z');

/**
 * Who is online: a heartbeat in the last 2 minutes, or an action in the last 5. What they're doing
 * comes from the heartbeat when there is one, otherwise from their latest action.
 */
export function onlineFromSignals(
  rows: SignalRow[],
  now: Date,
): Map<string, OnlinePerson> {
  const byUser = new Map<string, SignalRow[]>();
  for (const row of rows) {
    if (!row.user_id) continue;
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
    byUser.get(row.user_id)!.push(row);
  }
  const online = new Map<string, OnlinePerson>();
  for (const [userId, signals] of byUser) {
    const presence = signals.find((s) => s.kind === 'presence');
    const actions = signals
      .filter((s) => s.kind !== 'presence')
      .sort((a, b) => toDate(b.at).getTime() - toDate(a.at).getTime());
    const latestAction = actions[0];
    const recentAction =
      !!latestAction &&
      now.getTime() - toDate(latestAction.at).getTime() <= RECENT_ACTION_MS;
    if (!presence && !recentAction) continue;
    const times = signals.map((s) => toDate(s.at).getTime());
    online.set(userId, {
      userId,
      doing:
        presence?.doing ||
        (latestAction ? (DOING[latestAction.kind] ?? null) : null),
      since: presence?.session_started_at
        ? toDate(presence.session_started_at)
        : new Date(Math.min(...times)),
      lastAt: new Date(Math.max(...times)),
    });
  }
  return online;
}

/** "under a minute", "12 min", "1 h 05 min". */
export const readingLength = (seconds: number) => {
  if (seconds < 60) return 'under a minute';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
};

const planLabel = (name: string) =>
  /\bplan$/i.test(name.trim()) ? name.trim() : `${name.trim()} plan`;

/** The sentence shown for one event, e.g. "finished a test on Renal Pharmacology and scored 79%". */
export function describeEvent(
  row: EventRow,
  documentTitles: Map<string, string>,
  planNames: Map<string, string>,
): string {
  const title = (row.doc_id && documentTitles.get(row.doc_id)) || 'a document';
  const num =
    row.num === null || row.num === undefined ? null : Number(row.num);
  switch (row.type) {
    case 'sign_up':
      return row.extra === 'google'
        ? 'signed up with Google'
        : 'signed up with email';
    case 'upload':
      return `uploaded ${row.extra || 'a document'}`;
    case 'test_generated':
      return `made ${(num !== null && QUESTION_KINDS[num]) || 'a test'} from ${title}`;
    case 'test_finished':
      return num === null
        ? `finished a test on ${title}`
        : `finished a test on ${title} and scored ${Math.round(num)}%`;
    case 'chat':
      return `asked a question about ${title}`;
    case 'viva':
      return row.extra === 'finished'
        ? `finished an oral viva on ${title}`
        : `started an oral viva on ${title}`;
    case 'purchase': {
      if (!row.extra) return 'started a subscription';
      const name = planNames.get(row.extra);
      return name
        ? `paid for the ${planLabel(name)}`
        : 'bought a one-time plan';
    }
    case 'easy_read':
      return `read ${title} in Easy Read for ${readingLength(num ?? 0)}`;
    default:
      return row.extra || '';
  }
}
