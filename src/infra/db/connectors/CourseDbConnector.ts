import { Injectable } from '@nestjs/common';
import { CourseModel } from '../models/CourseModel';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';

@Injectable()
export class CourseDbConnector {
  constructor() {}

  public async create(course: CourseModel) {
    try {
      return await CourseModel.create(course);
    } catch (error) {
      throw new DatabaseError('Failed to save course').InnerError(error);
    }
  }

  public async deleteAllUserCourses(userId: string) {
    try {
      return await CourseModel.destroy({ where: { userId } });
    } catch (error) {
      throw new DatabaseError('Failed to delete all user courses').InnerError(
        error,
      );
    }
  }
}
