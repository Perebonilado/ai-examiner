import { Injectable } from '@nestjs/common';
import { PreferredLanguageModel } from '../models/PreferredLanguageModel';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';

@Injectable()
export class PreferredLanguageDbConnector {
  constructor() {}

  public async create(model: PreferredLanguageModel) {
    try {
      return await PreferredLanguageModel.create(model);
    } catch (error) {
      throw new DatabaseError('Failed to save preferred language').InnerError(
        error,
      );
    }
  }

  public async update(model: PreferredLanguageModel) {
    try {
      await PreferredLanguageModel.update(model, {
        where: { userId: model.userId },
        fields: ['language'],
      });
      return await PreferredLanguageModel.findOne({ where: { id: model.id } });
    } catch (error) {
      throw new DatabaseError('Failed to update preferred language').InnerError(
        error,
      );
    }
  }
}
