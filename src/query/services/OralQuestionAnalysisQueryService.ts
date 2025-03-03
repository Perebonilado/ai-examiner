import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { OralQuestionAnalysisModel } from 'src/infra/db/models/OralQuestionAnalysisModel';

@Injectable()
export class OralQuestionAnalysisQueryService {
  public async findByQuestionId(questionId: string) {
    try {
      return await OralQuestionAnalysisModel.findOne({ where: { questionId } });
    } catch (error) {
      throw new QueryError(
        'Failed to find oral question analysis by question id ' + questionId,
      );
    }
  }
}
