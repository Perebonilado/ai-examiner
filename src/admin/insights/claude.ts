import Anthropic from '@anthropic-ai/sdk';
import { EnvironmentVariables } from 'src/EnvironmentVariables';

/** One Anthropic client for the insights jobs (the same account and key as the app). */
let client: Anthropic | null = null;
export const claude = () =>
  (client ??= new Anthropic({
    apiKey: EnvironmentVariables.config.anthropicApiKey,
    maxRetries: 3,
  }));

/** Re-runs a declined request on a fallback model (direct calls only; batches can't use it). */
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** The text of a reply, joined. */
export const textOf = (content: { type: string; text?: string }[]) =>
  content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');

/** Parses a structured-output reply; null when it isn't valid JSON. */
export const jsonOf = <T>(
  content: { type: string; text?: string }[],
): T | null => {
  try {
    return JSON.parse(textOf(content)) as T;
  } catch {
    return null;
  }
};

export interface TokenTotals {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
}

export const tokensOf = (usage: any): TokenTotals => ({
  input: Number(usage?.input_tokens ?? 0),
  cacheWrite: Number(usage?.cache_creation_input_tokens ?? 0),
  cacheRead: Number(usage?.cache_read_input_tokens ?? 0),
  output: Number(usage?.output_tokens ?? 0),
});
