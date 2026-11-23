/**
 * Day boundaries for the dashboard, in West Africa Time (Africa/Lagos, UTC+1 all year: no
 * daylight saving), so "today" means today for the team in Nigeria.
 */
const WAT_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" of the WAT day containing `date`. */
export const watDay = (date: Date = new Date()): string =>
  new Date(date.getTime() + WAT_OFFSET_MS).toISOString().slice(0, 10);

/** The instant the WAT day `day` ("YYYY-MM-DD") starts. */
export const watDayStart = (day: string): Date =>
  new Date(Date.parse(`${day}T00:00:00Z`) - WAT_OFFSET_MS);

/** Start of the WAT day containing `date`. */
export const startOfWatDay = (date: Date = new Date()): Date =>
  watDayStart(watDay(date));

/** `day` moved by `n` days. */
export const addDays = (day: string, n: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS)
    .toISOString()
    .slice(0, 10);

/** The last `n` WAT days, oldest first, ending today. */
export const lastWatDays = (n: number, now: Date = new Date()): string[] => {
  const today = watDay(now);
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
};

/** SQL that turns a UTC DATETIME column into its WAT day string. */
export const sqlWatDay = (column: string) =>
  `DATE_FORMAT(DATE_ADD(${column}, INTERVAL 1 HOUR), '%Y-%m-%d')`;

/** "Chrome · Android" from a user-agent string (null when it can't tell). */
export const describeDevice = (userAgent?: string | null): string | null => {
  if (!userAgent) return null;
  const ua = userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser/.test(ua)
        ? 'Samsung Internet'
        : /Chrome\/|CriOS/.test(ua)
          ? 'Chrome'
          : /Firefox\/|FxiOS/.test(ua)
            ? 'Firefox'
            : /Safari\//.test(ua)
              ? 'Safari'
              : /okhttp|Dalvik/i.test(ua)
                ? 'Android app'
                : null;
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : null;
  if (browser && os) return `${browser} · ${os}`;
  return browser || os;
};
