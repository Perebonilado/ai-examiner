import { ScoreRepository } from 'src/business/repository/ScoreRepository';
import { ScoreModel } from '../models/ScoreModel';
import { Inject } from '@nestjs/common';
import { ScoreDbConnector } from '../connectors/ScoreDbConnnector';
import RepositoryError from 'src/error-handlers/infra/RepositoryError';

export class ScoreSequelizeRepository implements ScoreRepository {
  constructor(
    @Inject(ScoreDbConnector) private scoreDbConnector: ScoreDbConnector,
  ) {}

  public async create(score: ScoreModel): Promise<ScoreModel> {
    try {
      return await this.scoreDbConnector.create(score);
    } catch (error) {
      throw new RepositoryError('Failed to save score').InnerError(error);
    }
  }
}
