import { Inject, Injectable } from '@nestjs/common';
import { QuestionRepository } from 'src/business/repository/QuestionRepository';
import { QuestionModel } from '../models/QuestionModel';
import RepositoryError from 'src/error-handlers/infra/RepositoryError';
import { QuestionDbConnector } from '../connectors/QuestionDbConnector';

@Injectable()
export class QuestionSequelizeRepository implements QuestionRepository {
  constructor(
    @Inject(QuestionDbConnector)
    private questionDbConnector: QuestionDbConnector,
  ) {}

  public async create(question: QuestionModel): Promise<QuestionModel> {
    try {
      return await this.questionDbConnector.create(question);
    } catch (error) {
      throw new RepositoryError('Failed to save questions').InnerError(error);
    }
  }
}
