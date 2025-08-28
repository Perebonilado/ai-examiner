import { z } from 'zod';

const TopicSchema = z.object({
  topic: z.string(),
  shortDescription: z.string()
})

export const TopicsSchema = z.object({
  topics: z.array(TopicSchema),
});
