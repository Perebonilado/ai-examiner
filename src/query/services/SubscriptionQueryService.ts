import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { SubscriptionModel } from 'src/infra/db/models/SubscriptionModel';

@Injectable()
export class SubscriptionQueryService {
  public async findByUserId(userId: string) {
    try {
      return await SubscriptionModel.findOne({ where: { userId } });
    } catch (error) {
      throw new QueryError('Failed to find subscription by user id').InnerError(
        error,
      );
    }
  }
}
