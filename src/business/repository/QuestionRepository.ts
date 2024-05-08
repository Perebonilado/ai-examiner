import { QuestionModel } from 'src/infra/db/models/QuestionModel';

export const QuestionRepository = Symbol('QuestionRepository');

export interface QuestionRepository {
  create(question: QuestionModel): Promise<QuestionModel>;
}
