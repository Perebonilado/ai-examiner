import { Inject, Injectable } from '@nestjs/common';
import RepositoryError from 'src/error-handlers/infra/RepositoryError';
import { DocumentTopicDbConnector } from '../connectors/DocumentTopicDbConnector';
import { DocumentTopicModel } from '../models/DocumentTopicModel';
import { DocumentTopicRepository } from 'src/business/repository/DocumentTopicRepository';

@Injectable()
export class DocumentTopicSequelizeRepository
  implements DocumentTopicRepository
{
  constructor(
    @Inject(DocumentTopicDbConnector)
    private documentDbConnector: DocumentTopicDbConnector,
  ) {}

  public async bulkCreate(
    topics: DocumentTopicModel[],
  ): Promise<DocumentTopicModel[]> {
    try {
      return await this.documentDbConnector.bulkCreate(topics);
    } catch (error) {
      console.log(error)
      throw new RepositoryError(
        'Failed to bulk create document topics',
      ).InnerError(error);
    }
  }

  public async delete(topic: DocumentTopicModel) {
    try {
      return await this.documentDbConnector.delete(topic);
    } catch (error) {
      throw new RepositoryError('Failed to delete document topic').InnerError(
        error,
      );
    }
  }
}
