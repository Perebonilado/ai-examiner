import { z } from 'zod';

export const SprintReadContentSchema = z.object({
  content: z.string(),
});
