import { Injectable } from '@nestjs/common';
import { FlaggedQuestionModel } from '../models/FlaggedQuestionsModel';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';

@Injectable()
export class FlaggedQuestionDbConnector {
  public async create(model: FlaggedQuestionModel) {
    try {
      return await FlaggedQuestionModel.create(model);
    } catch (error) {
      throw new DatabaseError('Failed to saved flagged question').InnerError(
        error,
      );
    }
  }
}
