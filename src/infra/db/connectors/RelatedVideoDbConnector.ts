import { Injectable } from '@nestjs/common';
import { RelatedVideoModel } from '../models/RelatedVideoModel';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';

@Injectable()
export class RelatedVideoDbConnector {
  public async create(model: RelatedVideoModel) {
    try {
      return await RelatedVideoModel.create(model);
    } catch (error) {
      throw new DatabaseError('Failed to save related video').InnerError(error);
    }
  }
}
