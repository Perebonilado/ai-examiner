import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { FlaggedQuestionModel } from 'src/infra/db/models/FlaggedQuestionsModel';

@Injectable()
export class FlaggedQuestionQueryService {
  public async findFlaggedQuestionsByTestId(testId: string) {
    try {
      return await FlaggedQuestionModel.findAll({
        where: { testId },
      });
    } catch (error) {
      throw new QueryError('Failed to find flagged questions').InnerError(
        error,
      );
    }
  }
}
