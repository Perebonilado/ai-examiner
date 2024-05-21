import { Injectable } from '@nestjs/common';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';
import { CourseDocumentModel } from '../models/CourseDocumentModel';

@Injectable()
export class CourseDocumentDbConnector {
  constructor() {}

  public async create(courseDocument: CourseDocumentModel) {
    try {
      return await CourseDocumentModel.create(courseDocument);
    } catch (error) {
      throw new DatabaseError('Failed to save Document').InnerError(
        error,
      );
    }
  }
}
