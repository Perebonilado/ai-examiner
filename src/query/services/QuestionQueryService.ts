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
      });
    } catch (error) {
      throw new QueryError('Failed to find questions').InnerError(error);
    }
  }
}
