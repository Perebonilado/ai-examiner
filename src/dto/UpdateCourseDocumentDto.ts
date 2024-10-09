export interface UpdateCourseDocumentDto {
  id: string;
  title?: string;
  isDeleted?: boolean;
  mcqDirectThreadId?: string;
  mcqUseCaseThreadId?: string;
  flashCardThreadId?: string;
  documentChatThreadId?: string;
}
