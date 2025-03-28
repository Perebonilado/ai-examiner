import { Injectable } from '@nestjs/common';
import { FlaggedDocumentMessageModel } from '../models/FlaggedDocumentMessageModel';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';

@Injectable()
export class FlaggedDocumentMessageDbConnector {
  public async create(model: FlaggedDocumentMessageModel) {
    try {
      return await FlaggedDocumentMessageModel.create(model);
    } catch (error) {
      throw new DatabaseError(
        'Failed to save flagged document message',
      ).InnerError(error);
    }
  }
}
