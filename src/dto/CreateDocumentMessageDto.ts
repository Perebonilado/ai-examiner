import { MessageReponseType } from 'src/infra/web/models/MessageResponseTypeModel';
import { QuestionType } from 'src/infra/web/models/QuestionTypeModel';

export interface CreateDocumentMessageDto {
  message: string;
  courseDocumentId: string;
  userId: string;
  responseFormat: MessageReponseType;
  notSureQuestion?: NotSureQuestion;
  documentSummaryData?: {
    message: string;
    fileId: string;
    documentId: string;
    threadId: string;
  };
}

export interface NotSureQuestion {
  question: string;
  options: string[];
  questionType: QuestionType;
}
