import { z } from 'zod';

const OptionSchema = z
  .array(
    z.object({
      value: z.string(),
      id: z.string(),
    }),
  )
  .describe(
    'THIS WILL HAVE A LENGTH OF 0. NO OPTIONS SHOULD BE WITHIN AND SHOULD BE LEFT EMPTY',
  );

export const EssaySchema = z.object({
  id: z.string(),
  question: z
    .string()
    .describe(
      'THIS SHOULD BE NEW AND NOT REPEATED FROM WHAT WAS GENERATED BEFORE. IT SHOULD ALSO BE IN MARKDOWN FORMAT',
    ),
  options: OptionSchema,
  explanation: z.string().describe('THIS SHOULD BE AN EMPTY STRING'),
  hint: z.string().describe('THIS SHOULD BE AN EMPTY STRING'),
  topic: z.string(),
});
