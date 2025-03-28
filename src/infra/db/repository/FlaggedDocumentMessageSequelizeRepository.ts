import { Injectable, Inject } from '@nestjs/common';
import { FlaggedDocumentMessageRepository } from 'src/business/repository/FlaggedDocumentMessageRepository';
import { FlaggedDocumentMessageDbConnector } from '../connectors/FlaggedDocumentMessageModelDbConnector';
import { FlaggedDocumentMessageModel } from '../models/FlaggedDocumentMessageModel';

@Injectable()
export class FlaggedDocumentMessageSequelizeRepository
  implements FlaggedDocumentMessageRepository
{
  constructor(
    @Inject(FlaggedDocumentMessageDbConnector)
    private flaggedDocumentMessageDbConnector: FlaggedDocumentMessageDbConnector,
  ) {}

  public async create(
    model: FlaggedDocumentMessageModel,
  ): Promise<FlaggedDocumentMessageModel> {
    return await this.flaggedDocumentMessageDbConnector.create(model);
  }
}
