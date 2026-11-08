/**
 * Pure helpers for page-by-page simplification. No imports, so they can be unit-tested alone.
 */

/** Work order: the page being read first, then the pages after it, then the ones before it. */
export const orderPagesForWork = (pageNumbers: number[], priority: number) => {
  const after = pageNumbers.filter((p) => p >= priority).sort((a, b) => a - b);
  const before = pageNumbers.filter((p) => p < priority).sort((a, b) => b - a);
  return [...after, ...before];
};

/** "1,2,5-8" -> {1,2,5,6,7,8}. Ignores anything outside 1..max or malformed. */
export const parsePageList = (value: string | undefined, max: number) => {
  const pages = new Set<number>();
  if (!value) return pages;
  for (const part of value.split(',')) {
    const [a, b] = part.split('-').map((n) => Number(n.trim()));
    if (!Number.isInteger(a)) continue;
    const end = Number.isInteger(b) ? b : a;
    for (let p = Math.max(1, a); p <= Math.min(max, end); p++) pages.add(p);
  }
  return pages;
};

export interface PageState {
  status: string;
  attempts: number;
  updatedOn?: Date | null;
}

/** A page a worker may take: pending, failed with attempts left, or abandoned mid-run. */
export const isClaimable = (
  page: PageState,
  staleBefore: Date,
  maxAttempts: number,
) => {
  if (page.status === 'pending') return true;
  if (page.attempts >= maxAttempts) return false;
  if (page.status === 'failed') return true;
  return (
    page.status === 'running' &&
    !!page.updatedOn &&
    new Date(page.updatedOn).getTime() < staleBefore.getTime()
  );
};

/** Failed for good: no attempts left. */
export const isFinallyFailed = (page: PageState, maxAttempts: number) =>
  page.status === 'failed' && page.attempts >= maxAttempts;
