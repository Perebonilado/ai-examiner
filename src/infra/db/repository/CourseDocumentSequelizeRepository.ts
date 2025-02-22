import { Inject, Injectable } from '@nestjs/common';
import { CourseDocumentRepository } from 'src/business/repository/CourseDocumentRepository';
import { CourseDocumentModel } from '../models/CourseDocumentModel';
import { CourseDocumentDbConnector } from '../connectors/CourseDocumentDbConnector';
import RepositoryError from 'src/error-handlers/infra/RepositoryError';

@Injectable()
export class CourseDocumentSequelizeRepository
  implements CourseDocumentRepository
{
  constructor(
    @Inject(CourseDocumentDbConnector)
    private courseDocumentDbConnector: CourseDocumentDbConnector,
  ) {}

  public async create(
    courseDocument: CourseDocumentModel,
  ): Promise<CourseDocumentModel> {
    try {
      return await this.courseDocumentDbConnector.create(courseDocument);
    } catch (error) {
      throw new RepositoryError('Failed to save Document').InnerError(error);
    }
  }

  public async update(
    courseDocument: CourseDocumentModel,
  ): Promise<CourseDocumentModel> {
    try {
      return await this.courseDocumentDbConnector.update(courseDocument);
    } catch (error) {
      throw new RepositoryError('Failed to update course document').InnerError(
        error,
      );
    }
  }

  public async deleteAllUserCourseDocuments(userId: string): Promise<number> {
    return await this.courseDocumentDbConnector.deleteAllUserCourseDocuments(
      userId,
    );
  }
}
