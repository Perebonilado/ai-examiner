import { Injectable } from '@nestjs/common';
import { DocumentReadingProgressModel } from '../models/DocumentReadingProgress';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';

@Injectable()
export class DocumentReadingProgressDbConnector {
  public async create(model: DocumentReadingProgressModel) {
    try {
      return await DocumentReadingProgressModel.create(model);
    } catch (error) {
      throw new DatabaseError(
        'Failed to create document reading progress',
      ).InnerError(error);
    }
  }

  public async delete(id: number) {
    try {
      await DocumentReadingProgressModel.destroy({ where: { id } });
    } catch (error) {
      throw new DatabaseError(
        'Failed to create document reading progress',
      ).InnerError(error);
    }
  }
}
