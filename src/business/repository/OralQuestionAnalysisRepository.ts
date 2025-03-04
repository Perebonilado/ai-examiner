import { OralQuestionAnalysisModel } from 'src/infra/db/models/OralQuestionAnalysisModel';

export const OralQuestionAnalysisRepository = Symbol(
  'OralQuestionAnalysisRepository',
);

export interface OralQuestionAnalysisRepository {
  create(
    oralQuestionAnalysis: OralQuestionAnalysisModel,
  ): Promise<OralQuestionAnalysisModel>;
}
