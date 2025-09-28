import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  AI,
  GenerateObjectModel,
  GenerateObjectResult,
  GenerateTextModel,
  ModelOptions,
} from './AI';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { generateObject, generateText } from 'ai';
import { createOpenAI, OpenAIProvider } from '@ai-sdk/openai';
import { ZodTypeAny } from 'zod';

export const OPENAI_CONN = Symbol('OPENAI_CONN');

@Injectable()
export class OpenAIConn implements AI {
  constructor() {
    this.model = createOpenAI({
      compatibility: 'strict',
      apiKey: EnvironmentVariables.config.openAiApiKey,
    });
  }

  private readonly model: OpenAIProvider;

  public async generateObject<SchemaType extends ZodTypeAny>(
    args: GenerateObjectModel<SchemaType>,
    options: ModelOptions,
  ): Promise<GenerateObjectResult<SchemaType>> {
    try {
      const res = await generateObject({
        model: this.model.responses(options?.model || 'gpt-4o-mini'),
        maxRetries: 3,
        mode: 'json',
        schemaName: args.schemaName,
        schemaDescription: args.schemaDescription,
        temperature: 0.8,
        topP: 0.7,
        schema: args.schema,
        prompt: args.prompt,
        messages: args.messages,
      });

      return res;
    } catch (error) {
      throw new HttpException(
        'OpenAI: Failed to generate object',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  public async generateText(
    args: GenerateTextModel,
    options: ModelOptions,
  ): Promise<string> {
    try {
      const { text } = await generateText({
        model: this.model.responses(options?.model || 'gpt-4o-mini'),
        maxRetries: 3,
        prompt: args.prompt,
        messages: args.messages,
      });

      return text;
    } catch (error) {
      throw new HttpException(
        'OpenAI: Failed to generate text',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
