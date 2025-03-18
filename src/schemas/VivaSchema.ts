import { z } from 'zod';

const OptionSchema = z
  .array(
    z.object({
      value: z.string(),
      id: z.string(),
    }),
  ).describe('THIS WILL HAVE A LENGTH OF 0. NO OPTIONS SHOULD BE WITHIN AND SHOULD BE LEFT EMPTY');

export const VivaSchema = z.object({
  id: z.string(),
  question: z
    .string()
    .describe(
      'THIS SHOULD BE NEW AND NOT REPEATED FROM WHAT WAS GENERATED BEFORE',
    ),
  options: OptionSchema,
  explanation: z.string(),
  hint: z.string(),
  topic: z.string(),
});
