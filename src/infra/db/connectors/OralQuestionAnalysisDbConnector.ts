import { Injectable } from '@nestjs/common';
import { OralQuestionAnalysisModel } from '../models/OralQuestionAnalysisModel';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';

@Injectable()
export class OralQuestionAnalysisDbConnector {
  public async create(oralQuestionAnalysis: OralQuestionAnalysisModel) {
    try {
      return await OralQuestionAnalysisModel.create(oralQuestionAnalysis);
    } catch (error) {
      throw new DatabaseError(
        'Failed to create oral question analysis',
      ).InnerError(error);
    }
  }
}
