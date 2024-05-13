import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { CourseDocumentModel } from 'src/infra/db/models/CourseDocumentModel';
import { QuestionModel } from 'src/infra/db/models/QuestionModel';
import { getPagination } from 'src/utils';

@Injectable()
export class QuestionQueryService {
  public async findAllQuestionsByDocumentIdAndUserId(
    documentId: string,
    userId: string,
    pageSize: number,
    page: number,
  ) {
    try {
      const { limit, offset } = getPagination(page, pageSize);
      const totalCount = await QuestionModel.count({
        where: { courseDocumentId: documentId, userId },
      });
      const questions = await QuestionModel.findAll({
        where: { courseDocumentId: documentId, userId },
        order: [['created_on', 'DESC']],
        limit,
        offset,
      });

      return {
        questions: questions,
        meta: {
          currentPage: page,
          pageSize,
          totalCount,
        },
      };
    } catch (error) {
      throw new QueryError('Failed to find questions').InnerError(error);
    }
  }

  public async findQuestionsById(id: string, userId: string) {
    try {
      const question = await QuestionModel.findOne({ where: { id, userId } });
      const courseDocument = await CourseDocumentModel.findOne({
        where: { id: question.courseDocumentId, userId },
      });

      return {
        id: question.id,
        topicTitle: courseDocument.title,
        topicId: courseDocument.id,
        createdOn: question.createdOn,
        questions: JSON.parse(question.data),
      };
    } catch (error) {
      throw new QueryError('Failed to find questions by id').InnerError(error);
    }
  }
}
