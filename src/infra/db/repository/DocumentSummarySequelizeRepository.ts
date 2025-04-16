import { Injectable, Inject } from '@nestjs/common';
import { DocumentSummaryRepository } from 'src/business/repository/DocumentSummaryRepository';
import { DocumentSummaryDbConnector } from '../connectors/DocumentSummaryDbConnector';
import { DocumentSummaryModel } from '../models/DocumentSummaryModel';
import RepositoryError from 'src/error-handlers/infra/RepositoryError';

@Injectable()
export class DocumentSummarySequelizeRepository
  implements DocumentSummaryRepository
{
  constructor(
    @Inject(DocumentSummaryDbConnector)
    private documentSummaryDbConnector: DocumentSummaryDbConnector,
  ) {}

  public async create(
    model: DocumentSummaryModel,
  ): Promise<DocumentSummaryModel> {
    try {
      return await this.documentSummaryDbConnector.create(model);
    } catch (error) {
      throw new RepositoryError('Failed to create document summary').InnerError(
        error,
      );
    }
  }
}
