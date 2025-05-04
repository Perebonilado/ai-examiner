import { z } from 'zod';

export const YoutubeKeywordsSchema = z.object({
  keywords: z.array(z.string()),
});
