import { z } from 'zod';

const OptionSchema = z
  .array(
    z.object({
      value: z.string(),
      id: z.string(),
    }),
  ).describe('THIS WILL HAVE A LENGTH OF ONLY 1 AND THAT ONE OBJECT WILL HOLD THE CORRECT INFORMATION TO THE QUESTION. JUST ONE OBJECT WITH THE RIGHT OPTION!!! VERY IMPORTANT')

export const FlashCardsSchema = z.object({
  id: z.string(),
  question: z
    .string()
    .describe(
      'THIS SHOULD BE NEW AND NOT REPEATED FROM WHAT WAS GENERATED BEFORE',
    ),
  options: OptionSchema,
  correctAnswerId: z.string(),
  explanation: z.string(),
  hint: z.string(),
  topic: z.string(),
});
