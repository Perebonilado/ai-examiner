import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { OneTimeSubscriptionModel } from 'src/infra/db/models/OneTimeSubscriptionModel';

@Injectable()
export class OneTimeSubscriptionQueryService {
  public async findByUserId(userId: string) {
    try {
      return await OneTimeSubscriptionModel.findOne({ where: { userId } });
    } catch (error) {
      throw new QueryError(
        'Failed to find one time subscription details by id',
      ).InnerError(error);
    }
  }
}
