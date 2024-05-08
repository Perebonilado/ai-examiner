export interface CreateCourseDocumentDto {
  title: string;
  courseId: string;
  file: Express.Multer.File;
  userId: string
}
