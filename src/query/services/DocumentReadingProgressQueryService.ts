import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { DocumentReadingProgressModel } from 'src/infra/db/models/DocumentReadingProgress';

@Injectable()
export class DocumentReadingProgressQueryService {
  public async findByDocumentId(documentId: string) {
    try {
      return await DocumentReadingProgressModel.findAll({
        where: { documentId },
      });
    } catch (error) {
      throw new QueryError('Failed to find document reading progress');
    }
  }
}
