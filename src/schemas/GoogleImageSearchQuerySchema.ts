import { z } from 'zod';

export const GoogleImageSearchQuerySchema = z.object({
  modifiedQuery: z.string(),
});
