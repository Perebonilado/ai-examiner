import { EssayQuestionAnalysisStatus } from 'src/infra/web/models/EssayQuestionAnalysisStatus';

export interface CreateEssayQuestionAnalysisRequest {
  question: string;
  analysis: string;
  status: EssayQuestionAnalysisStatus;
  questionId: string;
  score: number;
  answer: string;
}
