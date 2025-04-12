export interface UpdateCourseDocumentDto {
  id: string;
  title?: string;
  isDeleted?: boolean;
  openAiFileId?: string;
  mcqDirectHardThreadId?: string;
  mcqDirectMediumThreadId?: string;
  mcqDirectEasyThreadId?: string;
  mcqUseCaseHardThreadId?: string;
  mcqUseCaseMediumThreadId?: string;
  mcqUseCaseEasyThreadId?: string;
  flashCardHardThreadId?: string;
  flashCardMediumThreadId?: string;
  flashCardEasyThreadId?: string;
  multipleTrueFalseHardThreadId?: string;
  multipleTrueFalseMediumThreadId?: string;
  multipleTrueFalseEasyThreadId?: string;
  documentChatThreadId?: string;
  oralQuestionThreadId?: string
}
