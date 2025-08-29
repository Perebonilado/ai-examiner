import { CoreMessage, Message } from 'ai';
import { Schema, ZodTypeAny, z } from 'zod';

export interface GenerateObjectModel<T extends ZodTypeAny> {
  schemaName: string;
  schemaDescription?: string;
  schema: T;
  prompt?: string;
  messages?: CoreMessage[] | Omit<Message, "id">[]
}

export type GenerateObjectResult<TSchema extends ZodTypeAny> = {
  object: z.infer<TSchema>;
};

export type GenerateTextModel = Omit<
  GenerateObjectModel<any>,
  'schemaName' | 'schemaDescription' | 'schema' | 'schemaKey'
>;

export interface AI {
  generateObject<SchemaType extends ZodTypeAny>(
    args: GenerateObjectModel<SchemaType>,
  ): Promise<GenerateObjectResult<SchemaType>>;
  generateText(args: GenerateTextModel): Promise<string>;
}
