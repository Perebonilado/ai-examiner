import { MessageReponseType } from 'src/infra/web/models/MessageResponseTypeModel';
import { QuestionType } from 'src/infra/web/models/QuestionTypeModel';

export interface CreateDocumentMessageDto {
  message: string;
  courseDocumentId: string;
  userId: string;
  responseFormat: MessageReponseType;
  highlightToPrompt?: HighlightToPrompt;
  notSureQuestion?: NotSureQuestion;
  documentSummaryData?: {
    message: string;
    fileId: string;
    documentId: string;
    threadId: string;
  };
  imageDescriptionData?: {
    imageUrl: string;
  };
  /** Google Translate language code the app is shown in (e.g. "es"). */
  language?: string;
  /** Resending a message whose reply failed: the message itself is already saved. */
  retry?: boolean;
}

export interface NotSureQuestion {
  question: string;
  options: string[];
  questionType: QuestionType;
}

export type HighlightToPromptType = 'explain' | 'simplify' | 'define';

export interface HighlightToPrompt {
  question: string;
  highlight: HighlightToPromptType;
}
