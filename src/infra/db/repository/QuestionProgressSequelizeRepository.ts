import { Injectable, Inject } from '@nestjs/common';
import { QuestionProgressRepository } from 'src/business/repository/QuestionProgressRepository';
import { QuestionProgressDbConnector } from '../connectors/QuestionProgressDbConnector';
import { QuestionProgressModel } from '../models/QuestionProgressModel';
import RepositoryError from 'src/error-handlers/infra/RepositoryError';

@Injectable()
export class QuestionProgressSequelizeRepository
  implements QuestionProgressRepository
{
  constructor(
    @Inject(QuestionProgressDbConnector)
    private questionProgressDbConnector: QuestionProgressDbConnector,
  ) {}

  public async upsert(progress: QuestionProgressModel) {
    try {
      return await this.questionProgressDbConnector.upsert(progress);
    } catch (error) {
      throw new RepositoryError('Failed to upsert progress').InnerError(error);
    }
  }

  public async deleteAllUserQuestionProgressData(
    userId: string,
  ): Promise<number> {
    return await this.questionProgressDbConnector.deleteAllUserQuestionProgressData(
      userId,
    );
  }
}
