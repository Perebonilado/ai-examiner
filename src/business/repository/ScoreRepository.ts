import { ScoreModel } from 'src/infra/db/models/ScoreModel';

export const ScoreRepository = Symbol('ScoreRepository');

export interface ScoreRepository {
  create(score: ScoreModel): Promise<ScoreModel>;
  update(score: ScoreModel): Promise<ScoreModel>;
  delete(scoreId: string): Promise<void>;
  deleteAllUserScoreData(userId: string): Promise<number>;
}
