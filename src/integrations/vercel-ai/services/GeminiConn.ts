import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  AI,
  GenerateObjectModel,
  GenerateObjectResult,
  GenerateTextModel,
  ModelOptions,
} from './AI';
import {
  createGoogleGenerativeAI,
  GoogleGenerativeAIProvider,
} from '@ai-sdk/google';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { generateObject, generateText } from 'ai';
import { ZodTypeAny } from 'zod';

export const GEMINI_CONN = Symbol('GEMINI_CONN');

@Injectable()
export class GeminiConn implements AI {
  constructor() {
    this.model = createGoogleGenerativeAI({
      apiKey: EnvironmentVariables.config.geminiApiKey,
    });
  }

  private readonly model: GoogleGenerativeAIProvider;

  public async generateObject<SchemaType extends ZodTypeAny>(
    args: GenerateObjectModel<SchemaType>,
    options: ModelOptions,
  ): Promise<GenerateObjectResult<SchemaType>> {
    try {
      const res = await generateObject({
        model: this.model(options?.model || 'gemini-1.5-flash'),
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
        'Gemini: Failed to generate object',
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
        model: this.model(options?.model || 'gemini-1.5-flash'),
        maxRetries: 3,
        prompt: args.prompt,
        messages: args.messages,
      });

      return text;
    } catch (error) {
      throw new HttpException(
        'Gemini: Failed to generate text',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
