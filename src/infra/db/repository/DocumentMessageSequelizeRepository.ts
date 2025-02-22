import { Inject, Injectable } from '@nestjs/common';
import { DocumentMessageRepository } from 'src/business/repository/DocumentMessageRepository';
import { DocumentMessageDbConnector } from '../connectors/DocumentMessageDbConnector';
import RepositoryError from 'src/error-handlers/infra/RepositoryError';
import { DocumentMessageModel } from '../models/DocumentMessageModel';

@Injectable()
export class DocumentMessageSequelizeRepository
  implements DocumentMessageRepository
{
  constructor(private documentMessageDbConnector: DocumentMessageDbConnector) {}

  public async create(
    documentMessage: DocumentMessageModel,
  ): Promise<DocumentMessageModel> {
    try {
      return await this.documentMessageDbConnector.create(documentMessage);
    } catch (error) {
      throw new RepositoryError('Failed to save message').InnerError(error);
    }
  }

  public async deleteAllUserDocumentMessages(userId: string): Promise<number> {
    return await this.documentMessageDbConnector.deleteAllUserDocumentMessages(
      userId,
    );
  }
}
