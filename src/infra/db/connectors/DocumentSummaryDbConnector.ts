import { Injectable } from '@nestjs/common';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';
import { DocumentSummaryModel } from '../models/DocumentSummaryModel';

@Injectable()
export class DocumentSummaryDbConnector {
  public async create(model: DocumentSummaryModel) {
    try {
      return await DocumentSummaryModel.create(model);
    } catch (error) {
      throw new DatabaseError('Failed to save summary').InnerError(error);
    }
  }
}
