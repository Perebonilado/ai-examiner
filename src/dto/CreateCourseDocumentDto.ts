export interface CreateCourseDocumentDto {
  title: string;
  courseId: string;
  userId: string;
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
  fileId: string;
  topics?: string[] | null;
  selectedQuestionTopics?: string[] | null;
}
