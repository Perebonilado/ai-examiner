import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { generateUUID } from 'src/utils';
import { FALLBACK_BETA, claude, jsonOf, tokensOf } from './claude';
import { InsightsService } from './InsightsService';
import { AiTranslationModel } from './models';
import { INSIGHTS_MODEL, TRANSLATE_SCHEMA, TRANSLATE_SYSTEM } from './prompts';

/** Characters of source text per request: long conversations go in parts, translated side by side. */
const CHUNK_CHARS = 9_000;
const PARALLEL = 4;

interface Item {
  id: string;
  text: string;
}

export interface Translation {
  language: string;
  text: string;
}

/**
 * English translations of a conversation for the admin, on request. Each message is translated
 * once and kept, so opening it again costs nothing.
 */
@Injectable()
export class TranslateService {
  private running = new Map<string, Promise<unknown>>();

  constructor(@Inject(InsightsService) private insights: InsightsService) {}

  async conversation(key: string) {
    const existing = this.running.get(key);
    if (existing) await existing.catch(() => undefined);
    const job = this.translateConversation(key).finally(() =>
      this.running.delete(key),
    );
    this.running.set(key, job);
    return job;
  }

  private async translateConversation(key: string) {
    // Loads the thread without logging a view (opening it already did).
    const conv = await this.insights.conversation(key, null);
    const items: Item[] = conv.messages
      .filter((m) => m.text?.trim())
      .map((m) => ({ id: m.id, text: m.text }));
    const quoteKey =
      conv.label?.id && conv.label.quote ? `quote:${conv.label.id}` : null;
    if (quoteKey) items.push({ id: quoteKey, text: conv.label!.quote! });

    const done = await this.translate(items);
    const pick = (id: string) => {
      const t = done.get(id);
      return t && t.text ? t : null;
    };
    const messages: Record<string, Translation> = {};
    for (const m of conv.messages) {
      const t = pick(m.id);
      if (t) messages[m.id] = t;
    }
    const languages = [
      ...new Set(
        [...done.values()]
          .filter((t) => t.text && !/^english$/i.test(t.language))
          .map((t) => t.language),
      ),
    ];
    return {
      messages,
      quote: quoteKey ? pick(quoteKey) : null,
      languages,
    };
  }

  /** Translations for the items, from the store or from Claude for any not done yet. */
  private async translate(items: Item[]) {
    const out = new Map<string, Translation>();
    if (!items.length) return out;
    const stored = await AiTranslationModel.findAll({
      where: { itemKey: items.map((i) => i.id), lang: 'en' },
    });
    for (const s of stored)
      out.set(s.itemKey, { language: s.source, text: s.text });

    const missing = items.filter((i) => !out.has(i.id));
    const chunks: Item[][] = [];
    let current: Item[] = [];
    let size = 0;
    for (const item of missing) {
      if (current.length && size + item.text.length > CHUNK_CHARS) {
        chunks.push(current);
        current = [];
        size = 0;
      }
      current.push(item);
      size += item.text.length;
    }
    if (current.length) chunks.push(current);

    const queue = [...chunks];
    const worker = async () => {
      for (let chunk = queue.shift(); chunk; chunk = queue.shift()) {
        const results = await this.ask(chunk);
        for (const [id, t] of results) out.set(id, t);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(PARALLEL, chunks.length) }, worker),
    );
    return out;
  }

  private async ask(chunk: Item[]) {
    const results = new Map<string, Translation>();
    const stream = claude().beta.messages.stream({
      model: INSIGHTS_MODEL,
      max_tokens: 32000,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      system: [{ type: 'text', text: TRANSLATE_SYSTEM }],
      messages: [
        {
          role: 'user',
          content: `Translate these ${chunk.length} items. Return every id.\n\n${JSON.stringify(chunk)}`,
        },
      ],
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: TRANSLATE_SCHEMA },
      },
    } as any);
    const message: any = await stream.finalMessage();
    if (message.stop_reason === 'refusal')
      throw new HttpException(
        'Claude declined to translate this conversation.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    const parsed = jsonOf<{
      items: { id: string; language: string; english: string }[];
    }>(message.content);
    if (!parsed?.items)
      throw new HttpException(
        message.stop_reason === 'max_tokens'
          ? 'This conversation is too long to translate in one go.'
          : 'Claude couldn’t translate this. Try again.',
        HttpStatus.BAD_GATEWAY,
      );
    const tokens = tokensOf(message.usage);
    const ids = new Set(chunk.map((c) => c.id));
    const rows = parsed.items
      .filter((i) => ids.has(i.id))
      .map((i, n) => ({
        id: generateUUID(),
        itemKey: i.id,
        lang: 'en',
        source: String(i.language || 'Unknown').slice(0, 60),
        text: String(i.english ?? '').trim(),
        model: String(message.model ?? INSIGHTS_MODEL).slice(0, 40),
        // The request's tokens are booked on its first row.
        inputTokens:
          n === 0 ? tokens.input + tokens.cacheWrite + tokens.cacheRead : 0,
        outputTokens: n === 0 ? tokens.output : 0,
        createdOn: new Date(),
      }));
    if (rows.length)
      await AiTranslationModel.bulkCreate(rows as AiTranslationModel[], {
        ignoreDuplicates: true,
      });
    for (const r of rows)
      results.set(r.itemKey, { language: r.source, text: r.text });
    return results;
  }
}
