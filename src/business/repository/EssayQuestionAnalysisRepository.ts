import { EssayQuestionAnalysisModel } from 'src/infra/db/models/EssayQuestionAnalysisModel';

export const EssayQuestionAnalysisRepository = Symbol(
  'EssayQuestionAnalysisRepository',
);

export interface EssayQuestionAnalysisRepository {
  create(
    model: EssayQuestionAnalysisModel,
  ): Promise<EssayQuestionAnalysisModel>;
  update(
    model: EssayQuestionAnalysisModel,
  ): Promise<EssayQuestionAnalysisModel>;
}
