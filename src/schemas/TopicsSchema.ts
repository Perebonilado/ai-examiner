import { z } from 'zod';

export const TopicsSchema = z.object({
  topics: z.array(z.string()),
});
