import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { QuestionModel } from 'src/infra/db/models/QuestionModel';

@Injectable()
export class QuestionQueryService {
  public async findAllQUestionsByDocumentIdAndUserId(
    documentId: string,
    userId: string,
  ) {
    try {
      return await QuestionModel.findAll({
        where: { courseDocumentId: documentId, userId },
        order: [['created_on', 'DESC']],
      });
    } catch (error) {
      throw new QueryError('Failed to find questions').InnerError(error);
    }
  }

  public async findQuestionsById(id: string, userId: string) {
    try {
      const question = await QuestionModel.findOne({ where: { id, userId } });

      return {
        id: question.id,
        createdOn: question.createdOn,
        questions: JSON.parse(question.data),
      };
    } catch (error) {
      throw new QueryError('Failed to find questions by id').InnerError(error);
    }
  }
}
