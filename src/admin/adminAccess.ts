import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { select } from './sql';

/**
 * Who can open the admin: owners (the ADMIN_EMAILS setting, fixed on the server) and the admins
 * an owner adds from the dashboard (the admin_member table, cached for half a minute).
 */

const CACHE_MS = 30 * 1000;
let cache: { at: number; emails: Promise<Set<string>> } | null = null;

export const normalEmail = (email?: string | null) =>
  (email ?? '').trim().toLowerCase();

/** A plain check that it looks like an address: something@something.something. */
export const looksLikeEmail = (email: string) =>
  email.length <= 191 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const isOwnerEmail = (email?: string | null) =>
  !!email &&
  EnvironmentVariables.config.adminEmails.includes(normalEmail(email));

export const memberEmails = (): Promise<Set<string>> => {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.emails;
  const emails = select<{ email: string }>(
    `SELECT email FROM admin_member`,
  ).then((rows) => new Set(rows.map((r) => normalEmail(r.email))));
  // A failed read shouldn't stick: try again on the next request.
  emails.catch(() => (cache = null));
  cache = { at: Date.now(), emails };
  return emails;
};

/** Forget the cached list (after an owner adds or removes someone). */
export const clearAdminCache = () => {
  cache = null;
};

export const isAdmin = async (email?: string | null) => {
  if (!email) return false;
  if (isOwnerEmail(email)) return true;
  try {
    return (await memberEmails()).has(normalEmail(email));
  } catch {
    return false;
  }
};
