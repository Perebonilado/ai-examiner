import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { CourseModel } from 'src/infra/db/models/CourseModel';

@Injectable()
export class CourseQueryService {
  constructor() {}

  public async findAllUserCourses(userId: string) {
    try {
      return await CourseModel.findAll({ where: { userId } });
    } catch (error) {
      throw new QueryError('Failed to find user courses').InnerError(error);
    }
  }
}
