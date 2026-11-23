import { addDays, watDay, watDayStart } from './time';

/**
 * Date ranges for the admin pages. A range is a run of whole WAT days ("2026-10-25" to
 * "2026-11-23", both included), so every page agrees on where a day starts.
 */

export type Granularity = 'day' | 'week' | 'month';

export interface DayRange {
  /** First day, included. */
  from: string;
  /** Last day, included. */
  to: string;
  days: number;
  /** The instant `from` starts. */
  start: Date;
  /** The instant after `to` ends. */
  end: Date;
}

/** One point on a chart: the days it covers, both included. */
export interface Bucket {
  start: string;
  end: string;
}

/** About three years: enough for "All time" (the first sign-up was May 2024). */
export const MAX_RANGE_DAYS = 1100;
/** The day before anything was recorded: "All time" starts here. */
export const FIRST_DAY = '2024-05-01';

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const isDayKey = (value: unknown): value is string =>
  typeof value === 'string' &&
  DAY_KEY.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  ) + 1;

export const makeRange = (from: string, to: string): DayRange => ({
  from,
  to,
  days: daysBetween(from, to),
  start: watDayStart(from),
  end: watDayStart(addDays(to, 1)),
});

/**
 * Reads `from` / `to` query values. Missing or broken values fall back to the last
 * `fallbackDays` days; the end never passes today, the order is fixed if reversed, and the
 * length is capped.
 */
export function parseRange(
  from?: string,
  to?: string,
  now = new Date(),
  fallbackDays = 30,
): DayRange {
  const today = watDay(now);
  let end = isDayKey(to) && to < today ? to : today;
  let start = isDayKey(from) ? from : addDays(end, -(fallbackDays - 1));
  if (start > end) [start, end] = [end, start];
  if (daysBetween(start, end) > MAX_RANGE_DAYS)
    start = addDays(end, -(MAX_RANGE_DAYS - 1));
  return makeRange(start, end);
}

/** The same number of days just before `range`. */
export const previousRange = (range: DayRange): DayRange =>
  makeRange(addDays(range.from, -range.days), addDays(range.from, -1));

/** Day points up to ~4 months, weeks up to ~13 months, months beyond. */
export const autoGranularity = (days: number): Granularity =>
  days <= 120 ? 'day' : days <= 400 ? 'week' : 'month';

/** Which granularities make sense for a range of `days` (at least two points, at most ~160). */
export const allowedGranularities = (days: number): Granularity[] => {
  const out: Granularity[] = [];
  if (days <= 160) out.push('day');
  if (days >= 14) out.push('week');
  if (days >= 60) out.push('month');
  return out.length ? out : ['day'];
};

export const pickGranularity = (
  requested: unknown,
  days: number,
): Granularity => {
  const allowed = allowedGranularities(days);
  if (allowed.includes(requested as Granularity))
    return requested as Granularity;
  const auto = autoGranularity(days);
  return allowed.includes(auto) ? auto : allowed[0];
};

const monthKey = (day: string) => day.slice(0, 7);
const endOfMonth = (day: string) => {
  const [y, m] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

/**
 * The chart points for a range: each day; 7-day runs counted from the range's first day (so a
 * previous period lines up point for point); or calendar months cut to the range.
 */
export function bucketsOf(range: DayRange, granularity: Granularity): Bucket[] {
  const out: Bucket[] = [];
  if (granularity === 'month') {
    let start = range.from;
    while (start <= range.to) {
      const monthEnd = endOfMonth(start);
      const end = monthEnd < range.to ? monthEnd : range.to;
      out.push({ start, end });
      start = addDays(end, 1);
    }
    return out;
  }
  const step = granularity === 'week' ? 7 : 1;
  for (let i = 0; i < range.days; i += step) {
    const start = addDays(range.from, i);
    const last = addDays(range.from, Math.min(i + step, range.days) - 1);
    out.push({ start, end: last });
  }
  return out;
}

/**
 * SQL for the bucket a timestamp falls in, counted from :<anchor> (the period's start instant).
 * Months count calendar months from :<anchor>Ym ("202610").
 */
export const bucketIndexSql = (
  column: string,
  granularity: Granularity,
  anchor: string,
) => {
  if (granularity === 'month')
    return `PERIOD_DIFF(DATE_FORMAT(DATE_ADD(${column}, INTERVAL 1 HOUR), '%Y%m'), :${anchor}Ym)`;
  const seconds = granularity === 'week' ? 7 * 86400 : 86400;
  return `FLOOR(TIMESTAMPDIFF(SECOND, :${anchor}, ${column}) / ${seconds})`;
};

/** "202610" for the month a range starts in. */
export const yearMonthOf = (day: string) =>
  Number(monthKey(day).replace('-', ''));
