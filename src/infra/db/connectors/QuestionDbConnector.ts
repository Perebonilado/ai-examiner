import { Injectable } from '@nestjs/common';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';
import { QuestionModel } from '../models/QuestionModel';

@Injectable()
export class QuestionDbConnector {
  public async create(question: QuestionModel) {
    try {
      return await QuestionModel.create(question);
    } catch (error) {
      throw new DatabaseError('Failed to save questions').InnerError(error);
    }
  }
}
