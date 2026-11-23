import { maxEasyReadSecondsPerReport } from 'src/constants';
import { generateUUID } from 'src/utils';
import { run } from './sql';
import { watDay } from './time';

/** The WAT hour (0–23) of an instant. */
export const watHour = (date: Date) => (date.getUTCHours() + 1) % 24;

/** A gap longer than this between reports starts a new reading session. */
export const SESSION_GAP_SECONDS = 15 * 60;

/** Document ids are UUIDs; anything else is stored as "unknown" (''). */
export const cleanDocumentId = (value: unknown) =>
  typeof value === 'string' && /^[\w-]{1,64}$/.test(value) ? value : '';

/**
 * Adds reported Easy Read time to today's row for this person and document. At most one
 * report's worth, and never more than the time since that row's last report (plus a second),
 * so two tabs on the same document don't count double. One atomic statement: no read first.
 */
export async function recordReadingTime(
  userId: string,
  documentId: string,
  seconds: number,
  now: Date = new Date(),
) {
  const charge = Math.min(Math.round(seconds), maxEasyReadSecondsPerReport);
  if (!userId || !Number.isFinite(charge) || charge <= 0) return;
  const id = generateUUID();
  const day = watDay(now);
  // Per document and day: totals, sessions, what was read.
  await run(
    `INSERT INTO easy_read_reading (id, user_id, document_id, day, seconds, sessions, first_at, last_at)
     VALUES (:id, :userId, :documentId, :day, :seconds, 1, :now, :now) AS fresh
     ON DUPLICATE KEY UPDATE
       sessions = easy_read_reading.sessions +
         IF(TIMESTAMPDIFF(SECOND, easy_read_reading.last_at, fresh.last_at) > ${SESSION_GAP_SECONDS}, 1, 0),
       seconds = easy_read_reading.seconds +
         LEAST(fresh.seconds, GREATEST(0, TIMESTAMPDIFF(SECOND, easy_read_reading.last_at, fresh.last_at) + 1)),
       last_at = GREATEST(easy_read_reading.last_at, fresh.last_at)`,
    {
      id,
      userId,
      documentId: cleanDocumentId(documentId),
      day,
      seconds: charge,
      now,
    },
  );
  // Per hour, across documents: when students read.
  await run(
    `INSERT INTO easy_read_reading_hour (id, user_id, day, hour, seconds, last_at)
     VALUES (:id, :userId, :day, :hour, :seconds, :now) AS fresh
     ON DUPLICATE KEY UPDATE
       seconds = easy_read_reading_hour.seconds +
         LEAST(fresh.seconds, GREATEST(0, TIMESTAMPDIFF(SECOND, easy_read_reading_hour.last_at, fresh.last_at) + 1)),
       last_at = GREATEST(easy_read_reading_hour.last_at, fresh.last_at)`,
    {
      id: generateUUID(),
      userId,
      day,
      hour: watHour(now),
      seconds: charge,
      now,
    },
  );
}
