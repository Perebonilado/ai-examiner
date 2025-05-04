import { RelatedVideoModel } from 'src/infra/db/models/RelatedVideoModel';

export const RelatedVideoRepository = Symbol('RelatedVideoRepository');

export interface RelatedVideoRepository {
  create(model: RelatedVideoModel): Promise<RelatedVideoModel>;
}
