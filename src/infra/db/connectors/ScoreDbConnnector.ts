import { Injectable } from '@nestjs/common';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';
import { ScoreModel } from '../models/ScoreModel';

@Injectable()
export class ScoreDbConnector {
  constructor() {}

  public async create(score: ScoreModel) {
    try {
      return await ScoreModel.create(score);
    } catch (error) {
      throw new DatabaseError('Failed to save score').InnerError(error);
    }
  }
}
