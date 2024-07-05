import { Injectable, Inject } from '@nestjs/common';
import { SubscriptionRepository } from 'src/business/repository/SubscriptionRepository';
import { SubscriptionDbConnector } from '../connectors/SubscriptionDbConnector';
import { SubscriptionModel } from '../models/SubscriptionModel';
import RepositoryError from 'src/error-handlers/infra/RepositoryError';
import { SubscriptionQueryService } from 'src/query/services/SubscriptionQueryService';

@Injectable()
export class SubscriptionSequelizeRepository implements SubscriptionRepository {
  constructor(
    @Inject(SubscriptionDbConnector)
    private subscriptionDbConnector: SubscriptionDbConnector,
    @Inject(SubscriptionQueryService)
    private subscriptionQuery: SubscriptionQueryService,
  ) {}

  public async create(
    subscription: SubscriptionModel,
  ): Promise<SubscriptionModel> {
    try {
      return await this.subscriptionDbConnector.create(subscription);
    } catch (error) {
      throw new RepositoryError('Failed to create subscription').InnerError(
        error,
      );
    }
  }

  public async update(
    subscription: SubscriptionModel,
  ): Promise<SubscriptionModel> {
    try {
      await this.subscriptionDbConnector.update(subscription);
      return await this.subscriptionQuery.findByUserId(subscription.userId);
    } catch (error) {
      throw new RepositoryError('Failed to update subscription').InnerError(
        error,
      );
    }
  }
}
