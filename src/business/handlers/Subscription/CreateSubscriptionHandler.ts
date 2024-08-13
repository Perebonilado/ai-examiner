import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateSubscriptionRequest } from '../request/CreateSubscriptionRequest';
import { CreateSubscriptionResponse } from '../response/CreateSubscriptionResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { SubscriptionRepository } from 'src/business/repository/SubscriptionRepository';
import { SubscriptionQueryService } from 'src/query/services/SubscriptionQueryService';
import { SubscriptionModel } from 'src/infra/db/models/SubscriptionModel';
import { PaystackSubscriptionService } from 'src/integrations/paystack/services/PaystackSubscriptionService';
import { UpdateSubscriptionHandler } from './UpdateSubscriptionHandler';

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
    @Inject(PaystackSubscriptionService)
    private paystackSucscriptionService: PaystackSubscriptionService,
    @Inject(UpdateSubscriptionHandler)
    private updateSubscriptionHandler: UpdateSubscriptionHandler,
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
        const subscriptionInfo =
          await this.paystackSucscriptionService.getActiveSubscriptions({
            customer: request.payload.subscriptionData.customer.id,
          });

        await this.subscriptionRepository.create({
          subscriptionCode: subscriptionInfo[0].subscrptionInformation.code,
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
        return await this.updateSubscriptionHandler.handle({
          payload: {
            subscriptionData: request.payload.subscriptionData,
            userId: request.payload.userId,
          },
        });
      }
    } catch (error) {
      throw new HandlerError(
        'Failed to handle subscription creation',
      ).InnerError(error);
    }
  }
}
