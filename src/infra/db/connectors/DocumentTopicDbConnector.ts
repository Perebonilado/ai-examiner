import { Injectable } from '@nestjs/common';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';
import { DocumentTopicModel } from '../models/DocumentTopicModel';

@Injectable()
export class DocumentTopicDbConnector {
  constructor() {}

  public async bulkCreate(
    documentTopics: DocumentTopicModel[],
  ): Promise<DocumentTopicModel[]> {
    try {
      return await DocumentTopicModel.bulkCreate(documentTopics);
    } catch (error) {
      throw new DatabaseError(
        'Failed to bulk create document topics',
      ).InnerError(error);
    }
  }

  public async delete(documentTopic: DocumentTopicModel) {
    try {
      return await documentTopic.destroy() 
    } catch (error) {
      throw new DatabaseError('Failed to delete document topic').InnerError(
        error,
      );
    }
  }
}
