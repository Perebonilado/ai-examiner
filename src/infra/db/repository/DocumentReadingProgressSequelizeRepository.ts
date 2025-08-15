import { Inject, Injectable } from '@nestjs/common';
import { DocumentReadingProgressDbConnector } from '../connectors/DocumentReadingProgressDbConntector';
import { DocumentReadingProgressRepository } from 'src/business/repository/DocumentReadingProgressRepository';
import { DocumentReadingProgressModel } from '../models/DocumentReadingProgress';

@Injectable()
export class DocumentReadingProgressSequelizeRepository
  implements DocumentReadingProgressRepository
{
  constructor(
    @Inject(DocumentReadingProgressDbConnector)
    private readonly documentReadingProgressDbConnector: DocumentReadingProgressDbConnector,
  ) {}

  public async create(
    model: DocumentReadingProgressModel,
  ): Promise<DocumentReadingProgressModel> {
    return await this.documentReadingProgressDbConnector.create(model);
  }

  public async delete(id: number): Promise<void> {
    return await this.documentReadingProgressDbConnector.delete(id);
  }
}
