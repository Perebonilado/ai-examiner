import { QuestionProgressModel } from 'src/infra/db/models/QuestionProgressModel';

export const QuestionProgressRepository = Symbol('QuestionProgressRepository');

export interface QuestionProgressRepository {
  upsert(progress: QuestionProgressModel): Promise<any>;
}
