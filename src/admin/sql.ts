import { QueryTypes } from 'sequelize';
import { sequelize } from 'src/infra/db/providers/DatabaseProvider';

/** "YYYY-MM-DD HH:MM:SS.mmm" in UTC, the way the app stores DATETIME values. */
const utcSql = (d: Date) => d.toISOString().replace('T', ' ').replace('Z', '');

/**
 * Run a read-only query with named replacements. Dates are passed as UTC strings: Sequelize
 * formats Date replacements in the server's local time zone, which would shift every time
 * boundary on a server that isn't running in UTC.
 */
export const select = <T = any>(
  sql: string,
  replacements: Record<string, unknown> = {},
): Promise<T[]> => {
  const safe = Object.fromEntries(
    Object.entries(replacements).map(([k, v]) => [
      k,
      v instanceof Date ? utcSql(v) : v,
    ]),
  );
  return sequelize.query(sql, {
    replacements: safe,
    type: QueryTypes.SELECT,
  }) as Promise<T[]>;
};

/** Run a write with the same date handling as `select`. */
export const run = (sql: string, replacements: Record<string, unknown> = {}) =>
  sequelize.query(sql, {
    replacements: Object.fromEntries(
      Object.entries(replacements).map(([k, v]) => [
        k,
        v instanceof Date ? utcSql(v) : v,
      ]),
    ),
    type: QueryTypes.RAW,
  });

/** Heartbeat within this window = online now. */
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;
/** Or an action the app's own tables recorded within this window (works before any heartbeat). */
export const RECENT_ACTION_MS = 5 * 60 * 1000;

/**
 * Per-user facts joined onto `user u`: presence, tests, documents, chats, scores, answers, Easy Read
 * time, recorded sign-ins and plan. Each table is grouped once (not per row) over a
 * (user_id, date) index, so it stays fast for tens of thousands of users.
 */
export const USER_FACTS_JOINS = `
  LEFT JOIN user_presence p ON p.user_id = u.id
  LEFT JOIN (SELECT user_id, COUNT(*) AS n, MAX(created_on) AS last_on FROM question GROUP BY user_id) qf
    ON qf.user_id = u.id
  LEFT JOIN (SELECT user_id, SUM(CASE WHEN is_deleted = 1 THEN 0 ELSE 1 END) AS n, MAX(created_on) AS last_on
             FROM course_document GROUP BY user_id) df
    ON df.user_id = u.id
  LEFT JOIN (SELECT user_id, MAX(created_on) AS last_on FROM document_message GROUP BY user_id) mf
    ON mf.user_id = u.id
  LEFT JOIN (SELECT user_id, COUNT(*) AS n, AVG(percentage_score) AS avg, MAX(created_on) AS last_on
             FROM score GROUP BY user_id) scf
    ON scf.user_id = u.id
  LEFT JOIN (SELECT user_id, MAX(modified_on) AS last_on FROM question_progress GROUP BY user_id) qpf
    ON qpf.user_id = u.id
  LEFT JOIN (SELECT user_id, MAX(last_active_on) AS last_on FROM easy_read_usage GROUP BY user_id) erf
    ON erf.user_id = u.id
  LEFT JOIN (SELECT user_id, SUM(seconds) AS seconds, MAX(last_at) AS last_on FROM easy_read_reading GROUP BY user_id) rrf
    ON rrf.user_id = u.id
  LEFT JOIN (SELECT user_id, MAX(created_on) AS last_on FROM user_activity GROUP BY user_id) af
    ON af.user_id = u.id
  LEFT JOIN (SELECT DISTINCT user_id FROM subscriptions) sf ON sf.user_id = u.id
  LEFT JOIN (SELECT DISTINCT user_id FROM one_time_subscription WHERE expires_on > UTC_TIMESTAMP()) of1
    ON of1.user_id = u.id
  LEFT JOIN email_preference ep ON ep.user_id = u.id
`;

const LAST_ON_COLUMNS = [
  'p.last_seen_at',
  'qf.last_on',
  'df.last_on',
  'mf.last_on',
  'scf.last_on',
  'qpf.last_on',
  'erf.last_on',
  'rrf.last_on',
  'af.last_on',
];

/**
 * Latest of: heartbeat, test made, document uploaded, chat, test finished, answer, Easy Read,
 * sign-in. Signing up alone isn't activity, so someone who never used the app has none (null).
 */
export const LAST_ACTIVE_SQL = `NULLIF(GREATEST(
    ${LAST_ON_COLUMNS.map((c) => `COALESCE(${c}, '1970-01-01')`).join(',\n    ')}
  ), '1970-01-01')`;

/** Has (or had) a recurring subscription, or a one-time plan that hasn't expired. */
export const IS_PAID_SQL = `(sf.user_id IS NOT NULL OR of1.user_id IS NOT NULL)`;

/** A real, reachable address (guest accounts use made-up aiexaminerguest… addresses). */
export const REAL_EMAIL_SQL = `(u.email LIKE '%@%' AND u.email NOT LIKE 'aiexaminerguest%@aiexaminer.com')`;

export const isGuestEmail = (email?: string | null) =>
  !!email && /^aiexaminerguest.*@aiexaminer\.com$/i.test(email);

export const fullName = (
  first?: string | null,
  last?: string | null,
  role?: string | null,
) => {
  if (role === 'guest') return 'Guest';
  return (
    [first, last]
      .filter((s) => s && s.trim() && s.trim().toLowerCase() !== 'guest')
      .join(' ')
      .trim() || 'No name'
  );
};

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

/** MySQL DATETIME values come back as Date (or string): normalise to ISO or null. */
export const iso = (value: unknown): string | null => {
  if (!value) return null;
  const d =
    value instanceof Date
      ? value
      : new Date(
          String(value).replace(' ', 'T') +
            (String(value).includes('Z') ? '' : 'Z'),
        );
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
