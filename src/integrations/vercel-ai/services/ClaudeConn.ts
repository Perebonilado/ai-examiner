import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  AI,
  GenerateObjectModel,
  GenerateObjectResult,
  GenerateTextModel,
  ModelOptions,
} from './AI';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { zodSchema } from 'ai';
import { ZodTypeAny } from 'zod';

export const CLAUDE_CONN = Symbol('CLAUDE_CONN');

const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_TOKENS = 16000;

@Injectable()
export class ClaudeConn implements AI {
  constructor() {
    this.client = new Anthropic({
      apiKey: EnvironmentVariables.config.anthropicApiKey,
      maxRetries: 3,
    });
  }

  private readonly client: Anthropic;

  public async generateObject<SchemaType extends ZodTypeAny>(
    args: GenerateObjectModel<SchemaType>,
    options?: ModelOptions,
  ): Promise<GenerateObjectResult<SchemaType>> {
    try {
      // Project schemas are zod v3, so convert them to JSON schema ourselves
      // instead of using the SDK's zod v4 helper.
      const { $schema, ...jsonSchema } = zodSchema(args.schema)
        .jsonSchema as Record<string, unknown>;

      const text = await this.createMessage(args, options, {
        type: 'json_schema',
        schema: jsonSchema,
      });

      return { object: args.schema.parse(JSON.parse(text)) };
    } catch (error) {
      throw new HttpException(
        'Claude: Failed to generate object',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  public async generateText(
    args: GenerateTextModel,
    options?: ModelOptions,
  ): Promise<string> {
    try {
      return await this.createMessage(args, options);
    } catch (error) {
      throw new HttpException(
        'Claude: Failed to generate text',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async createMessage(
    args: GenerateTextModel,
    options?: ModelOptions,
    format?: Anthropic.Beta.BetaJSONOutputFormat,
  ): Promise<string> {
    const { system, messages } = this.toAnthropicMessages(args);

    const response = await this.client.beta.messages.create({
      model: options?.model || DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      // Re-runs the request on a fallback model if Claude declines it.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: system || undefined,
      messages,
      ...(format ? { output_config: { format } } : {}),
    });

    if (response.stop_reason === 'refusal') {
      throw new Error(
        `Claude refused the request: ${response.stop_details?.category ?? 'unknown'}`,
      );
    }
    if (response.stop_reason === 'max_tokens') {
      throw new Error('Claude response was truncated (max_tokens reached)');
    }

    return response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  }

  private toAnthropicMessages(args: GenerateTextModel): {
    system: string;
    messages: Anthropic.Beta.BetaMessageParam[];
  } {
    const systemParts: string[] = [];
    const messages: Anthropic.Beta.BetaMessageParam[] = [];

    if (args.prompt) {
      messages.push({ role: 'user', content: args.prompt });
    }

    for (const message of args.messages ?? []) {
      if (message.role === 'system') {
        systemParts.push(this.contentToText(message.content));
      } else if (message.role === 'user' || message.role === 'assistant') {
        const content = this.toContentBlocks(message.content);
        if (content.length) {
          messages.push({ role: message.role, content });
        }
      }
    }

    // Chat history can start with an assistant greeting; the API expects the
    // conversation to open with a user turn.
    if (messages[0]?.role === 'assistant') {
      messages.unshift({ role: 'user', content: '(Conversation start)' });
    }

    return { system: systemParts.join('\n\n'), messages };
  }

  private contentToText(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((part) => (part?.type === 'text' ? part.text : ''))
        .join('');
    }
    return '';
  }

  private toContentBlocks(
    content: unknown,
  ): Anthropic.Beta.BetaContentBlockParam[] {
    const parts = typeof content === 'string'
      ? [{ type: 'text', text: content }]
      : Array.isArray(content)
        ? content
        : [];

    const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
    for (const part of parts) {
      if (part?.type === 'text' && part.text?.trim()) {
        blocks.push({ type: 'text', text: part.text });
      } else if (part?.type === 'image') {
        blocks.push(this.toImageBlock(part.image));
      }
    }
    return blocks;
  }

  private toImageBlock(image: unknown): Anthropic.Beta.BetaImageBlockParam {
    const value = image instanceof URL ? image.toString() : image;

    if (typeof value === 'string') {
      const dataUrl = value.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
      if (dataUrl) {
        return {
          type: 'image',
          source: {
            type: 'base64',
            media_type: dataUrl[1].toLowerCase() as
              | 'image/jpeg'
              | 'image/png'
              | 'image/gif'
              | 'image/webp',
            data: dataUrl[2],
          },
        };
      }
      if (/^https?:\/\//i.test(value)) {
        return { type: 'image', source: { type: 'url', url: value } };
      }
    }

    throw new Error('Claude: unsupported image input');
  }
}
