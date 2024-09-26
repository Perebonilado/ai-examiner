import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateOneTimeSubscriptionRequest } from '../request/CreateOneTimeSubscriptionRequest';
import { CreateOneTimeSubscriptionResponse } from '../response/CreateOneTimeSubscriptionResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { OneTimeSubscriptionRepository } from 'src/business/repository/OneTimeSubscriptionRepository';
import { OneTimeSubscriptionQueryService } from 'src/query/services/OneTimeSubscriptionQueryService';
import { OneTimeSubscriptionModel } from 'src/infra/db/models/OneTimeSubscriptionModel';
import { UpdateOneTimeSubscriptionHandler } from './UpdateOneTimeSubscriptionHandler';

@Injectable()
export class CreateOneTimeSubscriptionHandler extends AbstractRequestHandlerTemplate<
  CreateOneTimeSubscriptionRequest,
  CreateOneTimeSubscriptionResponse
> {
  constructor(
    @Inject(OneTimeSubscriptionRepository)
    private oneTimeSubscriptionRepository: OneTimeSubscriptionRepository,
    @Inject(OneTimeSubscriptionQueryService)
    private oneTimeSubscriptionQueryService: OneTimeSubscriptionQueryService,
    @Inject(UpdateOneTimeSubscriptionHandler)
    private updateOneTimeSubscriptionHandler: UpdateOneTimeSubscriptionHandler,
  ) {
    super();
  }

  protected async handleRequest(
    request: CreateOneTimeSubscriptionRequest,
  ): Promise<CommandResponse<CreateOneTimeSubscriptionResponse>> {
    try {
      const { expiresOn, planCode, userId } = request;

      const existingSubscription =
        await this.oneTimeSubscriptionQueryService.findByUserId(userId);

      if (!existingSubscription) {
        await this.oneTimeSubscriptionRepository.create({
          userId,
          planCode,
          expiresOn,
        } as OneTimeSubscriptionModel);

        return {
          data: { planId: planCode },
          message: 'One time subscription successfully created',
          status: HttpStatus.CREATED,
        };
      } else {
        return await this.updateOneTimeSubscriptionHandler.handle({
          ...request,
          id: existingSubscription.id,
          incrementSubscriptionCount: true
        });
      }
    } catch (error) {
      throw new HandlerError(
        'Failed to handle one time subscription creation',
      ).InnerError(error);
    }
  }
}
