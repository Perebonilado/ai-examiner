import { Injectable } from '@nestjs/common';
import { OneTimeSubscriptionModel } from '../models/OneTimeSubscriptionModel';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';

@Injectable()
export class OneTimeSubscriptionDbConnector {
  constructor() {}

  public async create(oneTimeSubscription: OneTimeSubscriptionModel) {
    try {
      return await OneTimeSubscriptionModel.create(oneTimeSubscription);
    } catch (error) {
      throw new DatabaseError(
        'Failed to create one time subscription',
      ).InnerError(error);
    }
  }

  public async update(oneTimeSubscription: OneTimeSubscriptionModel) {
    try {
      return await OneTimeSubscriptionModel.update(oneTimeSubscription, {
        where: { id: oneTimeSubscription.id },
      });
    } catch (error) {
      throw new DatabaseError(
        'Failed to update one time subscription',
      ).InnerError(error);
    }
  }

  public async deleteUserOneTimeSubscriptionData(userId: string) {
    try {
      return await OneTimeSubscriptionModel.destroy({ where: { userId } });
    } catch (error) {
      throw new DatabaseError(
        'Failed to delete user one time sub data',
      ).InnerError(error);
    }
  }
}
