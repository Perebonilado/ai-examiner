import axios from 'axios';
import { EnvironmentVariables } from 'src/EnvironmentVariables';

/**
 * Successful payments from Paystack, the only place that records every charge (renewals of a
 * recurring plan never reach our tables). Kept in memory for a few minutes; only the time, amount
 * and currency are kept, never who paid.
 */

export interface Payment {
  at: Date;
  /** Major units (naira, dollars). */
  amount: number;
  currency: string;
}

const FRESH_MS = 10 * 60 * 1000;
const RETRY_MS = 60 * 1000;
const PER_PAGE = 100;
const MAX_PAGES = 60;
const TIMEOUT_MS = 10000;
/** Pages fetched at once: Paystack slows down (and times out) when asked for many together. */
const CONCURRENCY = 4;

let cache: { at: number; payments: Payment[] | null } | null = null;
let inFlight: Promise<Payment[] | null> | null = null;

const get = async (page: number, tries = 2): Promise<any> => {
  try {
    const res = await axios.get('https://api.paystack.co/transaction', {
      params: {
        status: 'success',
        perPage: PER_PAGE,
        page,
        from: '2024-01-01',
      },
      headers: {
        Authorization: `Bearer ${EnvironmentVariables.config.paystackSecretKey}`,
      },
      timeout: TIMEOUT_MS,
    });
    return res.data;
  } catch (err) {
    if (tries > 1) return get(page, tries - 1);
    throw err;
  }
};

const toPayments = (rows: any[]): Payment[] =>
  rows
    .filter(
      (t) =>
        t && t.status === 'success' && (t.paid_at || t.paidAt || t.created_at),
    )
    .map((t) => ({
      at: new Date(t.paid_at || t.paidAt || t.created_at),
      amount: Number(t.amount || 0) / 100,
      currency: String(t.currency || 'NGN').toUpperCase(),
    }))
    .filter((p) => !Number.isNaN(p.at.getTime()));

async function fetchAll(): Promise<Payment[] | null> {
  try {
    const first = await get(1);
    const pages = Math.min(MAX_PAGES, Number(first?.meta?.pageCount) || 1);
    const rows: any[] = [...(first?.data ?? [])];
    for (let page = 2; page <= pages; page += CONCURRENCY) {
      const batch = await Promise.all(
        Array.from(
          { length: Math.min(CONCURRENCY, pages - page + 1) },
          (_, i) => get(page + i),
        ),
      );
      for (const b of batch) rows.push(...(b?.data ?? []));
    }
    return toPayments(rows);
  } catch {
    // A partial list would understate revenue: report it as unavailable instead.
    return null;
  }
}

const refresh = () => {
  if (!inFlight) {
    inFlight = fetchAll().then((result) => {
      // Keep the last good list if a refresh fails.
      cache = { at: Date.now(), payments: result ?? cache?.payments ?? null };
      inFlight = null;
      return cache.payments;
    });
  }
  return inFlight;
};

/**
 * Every successful payment, or null when Paystack can't be reached (the page says so). A stale
 * list is returned at once while a fresh one loads in the background.
 */
export async function payments(): Promise<Payment[] | null> {
  if (!cache) return refresh();
  const age = Date.now() - cache.at;
  if (age >= (cache.payments ? FRESH_MS : RETRY_MS)) {
    const pending = refresh();
    if (!cache.payments) return pending;
  }
  return cache.payments;
}

/** Starts loading payments early (at start-up), so the first overview doesn't wait. */
export const warmPayments = () => {
  void refresh();
};

/** Test hook. */
export const resetPaymentsCache = () => {
  cache = null;
  inFlight = null;
};
