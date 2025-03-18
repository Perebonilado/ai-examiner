import { z } from 'zod';

const OptionSchema = z
  .array(
    z.object({
      value: z.string(),
      id: z.string(),
    }),
  )

export const McqSchema = z.object({
  id: z.string(),
  question: z
    .string()
    .describe(
      'THIS SHOULD BE NEW AND NOT REPEATED FROM WHAT WAS GENERATED BEFORE.',
    ),
  options: OptionSchema,
  correctAnswerId: z.string(),
  explanation: z.string(),
  hint: z.string(),
  topic: z.string(),
});
