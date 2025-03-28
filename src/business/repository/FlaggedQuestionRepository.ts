import { FlaggedQuestionModel } from 'src/infra/db/models/FlaggedQuestionsModel';

export const FlaggedQuestionRepository = Symbol('FlaggedQuestionRepository');

export interface FlaggedQuestionRepository {
  create(model: FlaggedQuestionModel): Promise<FlaggedQuestionModel>;
}
