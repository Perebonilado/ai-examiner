import { z } from 'zod';

const TopicSchema = z.object({
  title: z.string(),
  startPage: z.number(),
  endPage: z.number(),
});

export const TopicsSchemaV2 = z.object({
  topics: z.array(TopicSchema),
});
