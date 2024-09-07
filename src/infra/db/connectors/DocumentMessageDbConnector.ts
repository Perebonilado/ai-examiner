import { Injectable } from '@nestjs/common';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';
import { DocumentMessageModel } from '../models/DocumentMessageModel';

@Injectable()
export class DocumentMessageDbConnector {
  constructor() {}

  public async create(documentMessage: DocumentMessageModel) {
    try {
      return await DocumentMessageModel.create(documentMessage);
    } catch (error) {
      throw new DatabaseError('Failed to save message').InnerError(error);
    }
  }
}
