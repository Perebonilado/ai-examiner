import { Injectable, Inject } from '@nestjs/common';
import { OneTimeSubscriptionRepository } from 'src/business/repository/OneTimeSubscriptionRepository';
import { OneTimeSubscriptionModel } from '../models/OneTimeSubscriptionModel';
import RepositoryError from 'src/error-handlers/infra/RepositoryError';
import { OneTimeSubscriptionDbConnector } from '../connectors/OneTimeSubscriptionDbConnector';

@Injectable()
export class OneTimeSubscriptionSequelizeRepository
  implements OneTimeSubscriptionRepository
{
  constructor(
    @Inject(OneTimeSubscriptionDbConnector)
    private oneTimeSubscriptionDbConnector: OneTimeSubscriptionDbConnector,
  ) {}

  public async create(
    oneTimeSub: OneTimeSubscriptionModel,
  ): Promise<OneTimeSubscriptionModel> {
    try {
      return await this.oneTimeSubscriptionDbConnector.create(oneTimeSub);
    } catch (error) {
      throw new RepositoryError(
        'Failed to create one time subscription',
      ).InnerError(error);
    }
  }

  public async update(
    oneTimeSub: OneTimeSubscriptionModel,
  ): Promise<OneTimeSubscriptionModel> {
    try {
      await this.oneTimeSubscriptionDbConnector.update(oneTimeSub);
      return await OneTimeSubscriptionModel.findOne({
        where: { id: oneTimeSub.id },
      });
    } catch (error) {
      throw new RepositoryError(
        'Failed to update one time subscription',
      ).InnerError(error);
    }
  }

  public async deleteUserOneTimeSubscriptionData(userId: string) {
    return await this.oneTimeSubscriptionDbConnector.deleteUserOneTimeSubscriptionData(
      userId,
    );
  }
}
