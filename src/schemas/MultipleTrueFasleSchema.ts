import { z } from 'zod';

const OptionSchema = z.object({
  value: z.string(),
  id: z.string(),
  answer: z.boolean(),
});

export const MultipleTrueFalseSchema = z.object({
  id: z.string(),
  question: z
    .string(),
  options: z
    .array(OptionSchema),
  explanation: z.string(),
  hint: z.string(),
  topic: z.string(),
});
