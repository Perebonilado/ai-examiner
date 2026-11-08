/**
 * How many reported seconds of Easy Read to charge: at most one report's worth, and never more
 * than the time since the last charge (plus a second of slack), so two open tabs don't count
 * double. No imports, so it can be unit-tested on its own.
 */
export const chargeableEasyReadSeconds = (
  reportedSeconds: number,
  lastActiveOn: Date | null | undefined,
  now: Date,
  maxPerReport: number,
) => {
  if (!Number.isFinite(reportedSeconds) || reportedSeconds <= 0) return 0;
  let seconds = Math.min(Math.round(reportedSeconds), maxPerReport);
  if (lastActiveOn) {
    const elapsed = (now.getTime() - new Date(lastActiveOn).getTime()) / 1000;
    if (elapsed >= 0) seconds = Math.min(seconds, Math.ceil(elapsed) + 1);
  }
  return Math.max(0, seconds);
};
