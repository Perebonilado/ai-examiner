import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { UpdateSubscriptionRequest } from '../request/UpdateSubscriptionRequest';
import { UpdateSubscriptionResponse } from '../response/UpdateSubscriptionResponse';
import { SubscriptionRepository } from 'src/business/repository/SubscriptionRepository';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import * as moment from 'moment';
import { SubscriptionModel } from 'src/infra/db/models/SubscriptionModel';
import { SubscriptionQueryService } from 'src/query/services/SubscriptionQueryService';
import { PaystackSubscriptionService } from 'src/integrations/paystack/services/PaystackSubscriptionService';

@Injectable()
export class UpdateSubscriptionHandler extends AbstractRequestHandlerTemplate<
  UpdateSubscriptionRequest,
  UpdateSubscriptionResponse
> {
  constructor(
    @Inject(SubscriptionRepository)
    private subscriptionRepository: SubscriptionRepository,
    @Inject(SubscriptionQueryService)
    private subscriptionQueryService: SubscriptionQueryService,
    @Inject(PaystackSubscriptionService)
    private paystackSubscriptionService: PaystackSubscriptionService,
  ) {
    super();
  }

  public async handleRequest(
    request: UpdateSubscriptionRequest,
  ): Promise<CommandResponse<UpdateSubscriptionResponse>> {
    try {
      const subscription = await this.subscriptionQueryService.findByUserId(
        request.payload.userId,
      );

      const subscriptionInfo =
        await this.paystackSubscriptionService.getActiveSubscriptions({
          customer: request.payload.subscriptionData.customer.id,
        });

      await this.subscriptionRepository.update({
        id: subscription.id,
        userId: subscription.userId,
        createdOn: subscription.createdOn,
        subscriptionCode: subscriptionInfo[0].subscrptionInformation.code,
        modifiedOn: moment(new Date()).utc().toDate(),
      } as SubscriptionModel);

      return {
        data: {
          planId: request.payload.subscriptionData.plan.plan_code,
          planName: request.payload.subscriptionData.plan.name,
        },
        message: 'Subscription Updated Successfully',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HandlerError('Failed to handle subscription update').InnerError(
        error,
      );
    }
  }
}
