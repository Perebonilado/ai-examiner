import { ScoreModel } from "src/infra/db/models/ScoreModel";

export const ScoreRepository = Symbol('ScoreRepository')

export interface ScoreRepository {
    create(score: ScoreModel): Promise<ScoreModel>
}