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
      throw new DatabaseError('Failed to save Document').InnerError(error);
    }
  }

  public async update(courseDocument: CourseDocumentModel) {
    try {
      await CourseDocumentModel.update(courseDocument, {
        where: { id: courseDocument.id },
        fields: [
          'title',
          'isDeleted',

          'mcqDirectEasyThreadId',
          'mcqDirectMediumThreadId',
          'mcqDirectHardThreadId',

          'mcqUseCaseEasyThreadId',
          'mcqUseCaseMediumThreadId',
          'mcqUseCaseHardThreadId',

          'multipleTrueFalseEasyThreadId',
          'multipleTrueFalseMediumThreadId',
          'multipleTrueFalseHardThreadId',

          'flashCardEasyThreadId',
          'flashCardHardThreadId',
          'flashCardMediumThreadId',

          'oralQuestionThreadId',
          'documentChatThreadId',
        ],
      });

      return await CourseDocumentModel.findOne({
        where: { id: courseDocument.id },
      });
    } catch (error) {
      throw new DatabaseError('Failed to update course document').InnerError(
        error,
      );
    }
  }

  public async deleteAllUserCourseDocuments(userId: string) {
    try {
      return await CourseDocumentModel.destroy({ where: { userId } });
    } catch (error) {
      throw new DatabaseError(
        'Failed to delete all user course documents',
      ).InnerError(error);
    }
  }
}
