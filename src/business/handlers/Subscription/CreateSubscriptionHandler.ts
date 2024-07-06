import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateSubscriptionRequest } from '../request/CreateSubscriptionRequest';
import { CreateSubscriptionResponse } from '../response/CreateSubscriptionResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { SubscriptionRepository } from 'src/business/repository/SubscriptionRepository';
import { SubscriptionQueryService } from 'src/query/services/SubscriptionQueryService';
import { SubscriptionModel } from 'src/infra/db/models/SubscriptionModel';

@Injectable()
export class CreateSubscriptionHandler extends AbstractRequestHandlerTemplate<
  CreateSubscriptionRequest,
  CreateSubscriptionResponse
> {
  constructor(
    @Inject(SubscriptionRepository)
    private subscriptionRepository: SubscriptionRepository,
    @Inject(SubscriptionQueryService)
    private subscriptionQueryService: SubscriptionQueryService,
  ) {
    super();
  }

  public async handleRequest(
    request: CreateSubscriptionRequest,
  ): Promise<CommandResponse<CreateSubscriptionResponse>> {
    try {
      const existingSubscription =
        await this.subscriptionQueryService.findByUserId(
          request.payload.userId,
        );

      if (!existingSubscription) {
        await this.subscriptionRepository.create({
            subscriptionCode: request.payload.subscriptionData.subscription_code,
            userId: request.payload.userId,
          } as SubscriptionModel);
  
          return {
            data: {
              planId: request.payload.subscriptionData.plan.plan_code,
              planName: request.payload.subscriptionData.plan.name,
            },
            message: 'Subscription Created',
            status: HttpStatus.CREATED,
          };
      } else {
        // call update subscription handler
      }
    } catch (error) {
      throw new HandlerError(
        'Failed to handle subscription creation',
      ).InnerError(error);
    }
  }
}
