import { z } from 'zod';

export const EssayAnalysisSchema = z.object({
  analysis: z.string().describe('A thorough analysis of the students response'),
  score: z
    .number()
    .describe('A strict score give out of 10 based on the students response'),
});
