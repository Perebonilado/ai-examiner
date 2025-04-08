import { EssayQuestionAnalysisStatus } from 'src/infra/web/models/EssayQuestionAnalysisStatus';

export interface UpdateEssayQuestionAnalysisRequest {
  id: number;
  status: EssayQuestionAnalysisStatus;
  analysis: string;
  score: number
  answer: string;
  question: string
}
