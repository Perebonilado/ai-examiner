import { Inject, Injectable } from '@nestjs/common';
import { CourseRepository } from 'src/business/repository/CourseRepository';
import { CourseModel } from '../models/CourseModel';
import { CourseDbConnector } from '../connectors/CourseDbConnector';
import RepositoryError from 'src/error-handlers/infra/RepositoryError';

@Injectable()
export class CourseSequelizeRepository implements CourseRepository {
  constructor(
    @Inject(CourseDbConnector) private courseDbConnector: CourseDbConnector,
  ) {}

  public async create(course: CourseModel): Promise<CourseModel> {
    try {
      return await this.courseDbConnector.create(course);
    } catch (error) {
      throw new RepositoryError('Failed to create course').InnerError(error);
    }
  }
}
