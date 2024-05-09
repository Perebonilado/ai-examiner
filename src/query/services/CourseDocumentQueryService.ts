import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { CourseDocumentModel } from 'src/infra/db/models/CourseDocumentModel';

@Injectable()
export class CourseDocumentQueryService {
  constructor() {}

  public async findAllUserCoursesDocumentsByCourseId(
    courseId: string,
    userId: string,
  ) {
    try {
      return await CourseDocumentModel.findAll({ where: { courseId, userId } });
    } catch (error) {
      throw new QueryError('Failed to find all course documents').InnerError(
        error,
      );
    }
  }
}
