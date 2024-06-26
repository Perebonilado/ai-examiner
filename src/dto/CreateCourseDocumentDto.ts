export interface CreateCourseDocumentDto {
  title: string;
  courseId: string;
  userId: string;
  threadId: string;
  fileId: string;
  topics?: string[] | null;
  selectedQuestionTopics?: string[] | null;
}
