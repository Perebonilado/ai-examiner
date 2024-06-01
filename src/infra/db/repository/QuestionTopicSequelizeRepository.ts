import { Inject, Injectable } from '@nestjs/common';
import { QuestionTopicRepository } from 'src/business/repository/QuestionTopicRepository';
import { QuestionTopicDbConnector } from '../connectors/QuestionTopicDbConnector';
import { QuestionTopicModel } from '../models/QuestionTopicModel';
import RepositoryError from 'src/error-handlers/infra/RepositoryError';

@Injectable()
export class QuestionTopicSequelizeRepository
  implements QuestionTopicRepository
{
  constructor(
    @Inject(QuestionTopicDbConnector)
    private questionTopicDbConnector: QuestionTopicDbConnector,
  ) {}

  public async bulkCreate(
    questionTopics: QuestionTopicModel[],
  ): Promise<QuestionTopicModel[]> {
    try {
      return await this.questionTopicDbConnector.bulkCreate(questionTopics);
    } catch (error) {
      throw new RepositoryError('Failed to bulk create ').InnerError(error);
    }
  }
}
