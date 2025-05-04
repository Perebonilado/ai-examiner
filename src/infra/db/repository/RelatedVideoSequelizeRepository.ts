import { Inject, Injectable } from '@nestjs/common';
import { RelatedVideoRepository } from 'src/business/repository/RelatedVideoRepository';
import { RelatedVideoDbConnector } from '../connectors/RelatedVideoDbConnector';
import { RelatedVideoModel } from '../models/RelatedVideoModel';

@Injectable()
export class RelatedVideoSequelizeRepository implements RelatedVideoRepository {
  constructor(
    @Inject(RelatedVideoDbConnector)
    private relatedVideoDbConnector: RelatedVideoDbConnector,
  ) {}

  public async create(model: RelatedVideoModel): Promise<RelatedVideoModel> {
    return await this.relatedVideoDbConnector.create(model);
  }
}
