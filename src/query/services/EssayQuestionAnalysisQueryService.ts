import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { EssayQuestionAnalysisModel } from 'src/infra/db/models/EssayQuestionAnalysisModel';

@Injectable()
export class EssayQuestionAnalysisQueryService {
  public async findById(id: number) {
    try {
      return await EssayQuestionAnalysisModel.findOne({ where: { id } });
    } catch (error) {
      throw new QueryError('Failed to find essay analysis by id').InnerError(
        error,
      );
    }
  }

  public async findByQuestionId(questionId: string) {
    try {
      return await EssayQuestionAnalysisModel.findAll({
        where: { questionId },
      });
    } catch (error) {
      throw new QueryError(
        'Failed to find essay analysis by question id',
      ).InnerError(error);
    }
  }
}
