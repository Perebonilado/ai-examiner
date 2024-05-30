import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { DocumentTopicModel } from 'src/infra/db/models/DocumentTopicModel';

@Injectable()
export class DocumentTopicQueryService {
  public async findDocumentTopicById(id: string) {
    try {
      return await DocumentTopicModel.findOne({ where: { id } });
    } catch (error) {
      throw new QueryError('Failed to find document topic').InnerError(error);
    }
  }

  public async findAllByDocumentTopicsByDocumentIdAndUserId(
    documentId: string,
    userId: string,
  ) {
    try {
      return await DocumentTopicModel.findAll({
        where: { documentId, userId },
      });
    } catch (error) {
      throw new QueryError(
        'Failed to find document topics by document and user id',
      ).InnerError(error);
    }
  }

  public async findDocumentTopicsByTitleAndId(
    title: string,
    documentId: string,
  ) {
    try {
      return await DocumentTopicModel.findOne({ where: { title, documentId } });
    } catch (error) {
      throw new QueryError(
        'Failed to find document topics by title and id',
      ).InnerError(error);
    }
  }
}
