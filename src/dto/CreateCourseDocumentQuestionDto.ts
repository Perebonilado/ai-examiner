import { CreateCourseDocumentDto } from './CreateCourseDocumentDto';
import { CreateCourseDto } from './CreateCourseDto';

export interface CreateCourseDocumentQuestionDto {
  courseInfo: Omit<CreateCourseDto, 'userId'>;
  documentInfo: Omit<CreateCourseDocumentDto, 'courseId' | 'userId'>;
}
