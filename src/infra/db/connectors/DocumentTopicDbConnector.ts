import { Inject, Injectable } from '@nestjs/common';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';
import { DocumentTopicModel } from '../models/DocumentTopicModel';
import { DocumentTopicQueryService } from 'src/query/services/DocumentTopicQueryService';

@Injectable()
export class DocumentTopicDbConnector {
  constructor(
    @Inject(DocumentTopicQueryService)
    private documentTopicQueryService: DocumentTopicQueryService,
  ) {}

  public async bulkCreate(
    documentTopics: DocumentTopicModel[],
  ): Promise<DocumentTopicModel[]> {
    try {
      const createdDocumentTopics = await DocumentTopicModel.bulkCreate(
        documentTopics,
        {
          updateOnDuplicate: ['title', 'documentId'],
        },
      );

      const documentTopicsWithIds = await Promise.all(
        createdDocumentTopics.map(async (topic) => {
          return await this.documentTopicQueryService.findDocumentTopicsByTitleAndId(
            topic.title,
            topic.documentId,
          );
        }),
      );

      return documentTopicsWithIds
    } catch (error) {
      throw new DatabaseError(
        'Failed to bulk create document topics',
      ).InnerError(error);
    }
  }

  public async delete(documentTopic: DocumentTopicModel) {
    try {
      return await documentTopic.destroy();
    } catch (error) {
      throw new DatabaseError('Failed to delete document topic').InnerError(
        error,
      );
    }
  }
}
