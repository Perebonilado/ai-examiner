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

  public async deleteUserSubscriptionData(userId: string) {
    try {
      return await SubscriptionModel.destroy({ where: { userId } });
    } catch (error) {
      throw new DatabaseError(
        'Failed to delete user subscription data',
      ).InnerError(error);
    }
  }
}
