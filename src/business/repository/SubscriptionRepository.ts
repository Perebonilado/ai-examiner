import { SubscriptionModel } from 'src/infra/db/models/SubscriptionModel';

export const SubscriptionRepository = Symbol('SubscriptionRepository');

export interface SubscriptionRepository {
  create(subscription: SubscriptionModel): Promise<SubscriptionModel>;
  update(subscription: SubscriptionModel): Promise<SubscriptionModel>;
  deleteUserSubscriptionData(userId: string): Promise<number>;
}
