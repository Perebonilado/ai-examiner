import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { DocumentSummaryModel } from 'src/infra/db/models/DocumentSummaryModel';

@Injectable()
export class DocumentSummaryQueryService {
  public async findByDocumentId(documentId: string) {
    try {
      return await DocumentSummaryModel.findOne({
        where: {
          documentId,
        },
      });
    } catch (error) {
      throw new QueryError('Failed to find document summary').InnerError(error);
    }
  }
}
