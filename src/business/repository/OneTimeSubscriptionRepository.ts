import { OneTimeSubscriptionModel } from 'src/infra/db/models/OneTimeSubscriptionModel';

export const OneTimeSubscriptionRepository = Symbol(
  'OneTimeSubscriptionRepository',
);

export interface OneTimeSubscriptionRepository {
  create(
    oneTimeSub: OneTimeSubscriptionModel,
  ): Promise<OneTimeSubscriptionModel>;
  update(
    oneTimeSub: OneTimeSubscriptionModel,
  ): Promise<OneTimeSubscriptionModel>;
}
