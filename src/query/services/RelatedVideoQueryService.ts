import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { RelatedVideoModel } from 'src/infra/db/models/RelatedVideoModel';

@Injectable()
export class RelatedVideoQueryService {
  public async findByDocumentId(id: string) {
    try {
      return await RelatedVideoModel.findOne({ where: { documentId: id } });
    } catch (error) {
      throw new QueryError(
        'Failed to find related video by document id',
      ).InnerError(error);
    }
  }
}
