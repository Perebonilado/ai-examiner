import { Bucket } from './range';

/**
 * SQL for the overview's analytics. Every query reads a date window (:aFrom to :aTo) on each
 * table's own date column, so it uses that table's date index.
 */

/** Lookup ids of question types (fixed in the `lookup` table). */
export const QUESTION_TYPE = {
  multipleChoice: 3,
  flashcards: 4,
  trueFalse: 5,
  viva: 6,
  essay: 7,
} as const;

const between = (column: string) => `${column} >= :aFrom AND ${column} < :aTo`;

/**
 * (user_id, at) for every sign that someone used the app: tests made, uploads, finished tests,
 * chats, answers, Easy Read time, payments, sign-ins and app visits. Signing up alone doesn't
 * count: a new account is a sign-up, not an active student.
 */
export const USAGE_ROWS_SQL = `
  SELECT user_id, created_on AS at FROM question WHERE ${between('created_on')}
  UNION ALL SELECT user_id, created_on FROM course_document WHERE ${between('created_on')}
  UNION ALL SELECT user_id, created_on FROM score WHERE ${between('created_on')}
  UNION ALL SELECT user_id, created_on FROM document_message WHERE ${between('created_on')}
  UNION ALL SELECT user_id, modified_on FROM question_progress WHERE ${between('modified_on')}
  UNION ALL SELECT user_id, last_active_on FROM easy_read_usage WHERE ${between('last_active_on')}
  UNION ALL SELECT user_id, last_at FROM easy_read_reading WHERE ${between('last_at')}
  UNION ALL SELECT user_id, created_on FROM subscriptions WHERE ${between('created_on')}
  UNION ALL SELECT user_id, created_on FROM one_time_subscription WHERE ${between('created_on')}
  UNION ALL SELECT user_id, created_on FROM user_activity WHERE ${between('created_on')}
  UNION ALL SELECT user_id, DATE_SUB(CAST(day AS DATETIME), INTERVAL 1 HOUR) FROM user_daily_active
    WHERE day >= :aFromDay AND day <= :aToDay`;

/**
 * (kind, at, val) for everything counted on the overview. Question rows carry their type id
 * ("q3" = multiple choice); finished tests carry their score.
 */
export const COUNTED_ROWS_SQL = `
  SELECT CASE WHEN password IS NULL OR password = '' THEN 'sign_up_google' ELSE 'sign_up_email' END AS kind,
    created_on AS at, NULL AS val FROM user WHERE role = 'user' AND ${between('created_on')}
  UNION ALL SELECT 'guest', created_on, NULL FROM user WHERE role = 'guest' AND ${between('created_on')}
  UNION ALL SELECT 'upload', created_on, NULL FROM course_document WHERE ${between('created_on')}
  UNION ALL SELECT CONCAT('q', question_type_id), created_on, NULL FROM question WHERE ${between('created_on')}
  UNION ALL SELECT 'test_finished', created_on, percentage_score FROM score WHERE ${between('created_on')}
  UNION ALL SELECT 'chat', created_on, NULL FROM document_message WHERE sender = 'user' AND ${between('created_on')}
  UNION ALL SELECT 'viva_finished', created_on, NULL FROM oral_question_analysis WHERE ${between('created_on')}
  UNION ALL SELECT 'summary', created_on, NULL FROM document_summary WHERE ${between('created_on')}
  UNION ALL SELECT type, created_on, NULL FROM user_activity
    WHERE type IN ('sign_in', 'easy_read') AND ${between('created_on')}`;

/**
 * (user_id, kind, at, secs) for what students did on purpose: tests, uploads, finished tests, chat
 * questions, and Easy Read (one row per document read per day, with its seconds). For the "Most
 * active" card.
 */
export const ACTION_ROWS_SQL = `
  SELECT user_id, CASE WHEN question_type_id = ${QUESTION_TYPE.viva} THEN 'viva' ELSE 'test' END AS kind,
    created_on AS at, 0 AS secs FROM question WHERE ${between('created_on')}
  UNION ALL SELECT user_id, 'upload', created_on, 0 FROM course_document WHERE ${between('created_on')}
  UNION ALL SELECT user_id, 'finished', created_on, 0 FROM score WHERE ${between('created_on')}
  UNION ALL SELECT user_id, 'chat', created_on, 0 FROM document_message WHERE sender = 'user' AND ${between('created_on')}
  UNION ALL SELECT user_id, 'easy_read', last_at, seconds FROM easy_read_reading WHERE ${between('last_at')}`;

/**
 * (user_id, day, hour) for each hour someone studied (any action, or reading in Easy Read), Lagos
 * time. For "When students study": counting distinct rows gives students per hour.
 */
export const STUDY_HOURS_SQL = `
  SELECT a.user_id, DATE_FORMAT(DATE_ADD(a.at, INTERVAL 1 HOUR), '%Y-%m-%d') AS day,
    HOUR(DATE_ADD(a.at, INTERVAL 1 HOUR)) AS hour
  FROM (
    SELECT user_id, created_on AS at FROM question WHERE ${between('created_on')}
    UNION ALL SELECT user_id, created_on FROM course_document WHERE ${between('created_on')}
    UNION ALL SELECT user_id, created_on FROM score WHERE ${between('created_on')}
    UNION ALL SELECT user_id, created_on FROM document_message WHERE sender = 'user' AND ${between('created_on')}
    UNION ALL SELECT user_id, modified_on FROM question_progress WHERE ${between('modified_on')}
  ) a
  UNION ALL SELECT user_id, day, hour FROM easy_read_reading_hour
    WHERE day >= :aFromDay AND day <= :aToDay AND seconds > 0`;

/** The Monday ("YYYY-MM-DD") of the WAT week `column` falls in. */
export const sqlWatMonday = (column: string) =>
  `DATE_FORMAT(DATE_SUB(DATE(DATE_ADD(${column}, INTERVAL 1 HOUR)),
     INTERVAL WEEKDAY(DATE_ADD(${column}, INTERVAL 1 HOUR)) DAY), '%Y-%m-%d')`;

/** The Monday of the week `day` ("YYYY-MM-DD") falls in. */
export const mondayOf = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
};

/** Index of the bucket holding `day`, or -1. Buckets are in order and don't overlap. */
export const bucketIndexOf = (buckets: Bucket[], day: string) => {
  let lo = 0;
  let hi = buckets.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (day < buckets[mid].start) hi = mid - 1;
    else if (day > buckets[mid].end) lo = mid + 1;
    else return mid;
  }
  return -1;
};
