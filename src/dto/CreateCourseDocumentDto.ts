export interface CreateCourseDocumentDto {
  title: string;
  courseId: string;
  userId: string;
  mcqDirectThreadId?: string;
  mcqUseCaseThreadId?: string;
  flashCardThreadId?: string;
  documentChatThreadId?: string;
  fileId: string;
  topics?: string[] | null;
  selectedQuestionTopics?: string[] | null;
}
