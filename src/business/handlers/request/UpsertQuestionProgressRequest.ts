import { UpsertQuestionProgressDTO } from 'src/dto/UpsertQuestionProgressDto';

export interface UpsertQuestionProgressRequest {
  data?: [UpsertQuestionProgressDTO];
  questionId: string;
  userId: string;
}
