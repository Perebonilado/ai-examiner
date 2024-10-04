import { QuestionProgressStatusType } from "src/infra/web/models/QuestionProgressStatusType";

export interface UpsertQuestionProgressDTO {
  selectedQuestionId: string;
  selectedOptionId: string;
}
