import { QuestionTopicModel } from 'src/infra/db/models/QuestionTopicModel';

export const QuestionTopicRepository = Symbol('QuestionTopicRepository');

export interface QuestionTopicRepository {
  bulkCreate(
    questionTopics: QuestionTopicModel[],
  ): Promise<QuestionTopicModel[]>;
}
