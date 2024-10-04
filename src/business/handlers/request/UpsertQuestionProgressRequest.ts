import { UpsertQuestionProgressDTO } from 'src/dto/UpsertQuestionProgressDto';
import { QuestionProgressStatusType } from 'src/infra/web/models/QuestionProgressStatusType';

export interface UpsertQuestionProgressRequest {
  data?: [UpsertQuestionProgressDTO];
  questionId: string;
  userId: string;
  status: QuestionProgressStatusType;
  clearExistingProgress: boolean;
}
