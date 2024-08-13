import { Injectable } from '@nestjs/common';
import { SubscriptionModel } from '../models/SubscriptionModel';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';

@Injectable()
export class SubscriptionDbConnector {
  constructor() {}

  public async create(
    subscription: SubscriptionModel,
  ): Promise<SubscriptionModel> {
    try {
      return await SubscriptionModel.create(subscription);
    } catch (error) {
      throw new DatabaseError('Failed to create subscription').InnerError(
        error,
      );
    }
  }

  public async update(subscription: SubscriptionModel) {
    try {
      return await SubscriptionModel.update(subscription, {
        where: { id: subscription.id },
      });
    } catch (error) {
      throw new DatabaseError('Failed to update subscription').InnerError(
        error,
      );
    }
  }
}
