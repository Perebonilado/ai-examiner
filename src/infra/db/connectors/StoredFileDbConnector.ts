import { Injectable } from '@nestjs/common';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';
import { StoredFileModel } from '../models/StoredFileModel';

@Injectable()
export class StoredFileDbConnector {
  public async create(model: StoredFileModel) {
    try {
      return await StoredFileModel.create(model);
    } catch (error) {
      throw new DatabaseError(
        'Failed to save file storage information',
      ).InnerError(error);
    }
  }

  public async update(model: StoredFileModel) {
    try {
      await StoredFileModel.update(model, {
        where: { id: model.id },
        fields: ['simplifiedFileLocation'],
      });

      return await StoredFileModel.findOne({ where: { id: model.id } });
    } catch (error) {
      throw new DatabaseError('Failed to update stored file').InnerError(error);
    }
  }
}
