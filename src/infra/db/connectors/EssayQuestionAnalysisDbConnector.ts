import { Injectable } from '@nestjs/common';
import { EssayQuestionAnalysisModel } from '../models/EssayQuestionAnalysisModel';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';

@Injectable()
export class EssayQuestionAnalysisDbConnector {
  constructor() {}

  public async create(model: EssayQuestionAnalysisModel) {
    try {
      return await EssayQuestionAnalysisModel.create(model);
    } catch (error) {
      throw new DatabaseError('Failed to save essay analysis').InnerError(
        error,
      );
    }
  }

  public async update(model: EssayQuestionAnalysisModel) {
    try {
      await EssayQuestionAnalysisModel.update(model, {
        where: { id: model.id },
        fields: ['analysis', 'status', 'score'],
      });

      return EssayQuestionAnalysisModel.findOne({ where: { id: model.id } });
    } catch (error) {
      throw new DatabaseError('Failed to update essay analysis').InnerError(
        error,
      );
    }
  }
}
