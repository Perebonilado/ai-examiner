export interface RecordEasyReadUsageRequest {
  userId: string;
  /** Calendar month in UTC, "YYYY-MM". */
  month: string;
  /** Seconds of reading the app reports since its last report. */
  seconds: number;
  now: Date;
}
