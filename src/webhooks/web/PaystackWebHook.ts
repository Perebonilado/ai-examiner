import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { PaystackEventDto } from '../dto/PaystackEventDto';
import { CreateSubscriptionHandler } from 'src/business/handlers/Subscription/CreateSubscriptionHandler';
import { UserQueryService } from 'src/query/services/UserQueryService';
import { NotificationsGateway } from 'src/notification/services/NotificationsGateway';
import { ChargeSuccessEventDto } from '../dto/ChargeSuccessDto';
import { CreateOneTimeSubscriptionHandler } from 'src/business/handlers/OneTimeSubscription/CreateOneTimeSubscriptionHandler';
import * as moment from 'moment';

@Controller('webhook/paystack')
export class PaystackWebhook {
  constructor(
    @Inject(CreateSubscriptionHandler)
    private createSubscriptionHandler: CreateSubscriptionHandler,
    @Inject(UserQueryService) private userQueryService: UserQueryService,
    private notificationsGateway: NotificationsGateway,
    @Inject(CreateOneTimeSubscriptionHandler)
    private createOneTimeSubscriptionHandler: CreateOneTimeSubscriptionHandler,
  ) {}

  @Post('')
  public async processPayments(
    @Res() response: Response,
    @Body() body: PaystackEventDto,
  ) {
    try {
      // acknowledge
      response.sendStatus(200);

      switch (body.event) {
        case 'charge.success':
          {
            if (body.data.channel === 'card') {
              //recurring card subscription
              const subscriptionData = body.data as ChargeSuccessEventDto<any>;

              const user = await this.userQueryService.findOne(
                subscriptionData.customer.email,
              );

              await this.createSubscriptionHandler.handle({
                payload: { subscriptionData, userId: user.id },
              });

              this.notificationsGateway.notifyClient(user.email, {
                status: 'successful',
                message: 'Payment for subscription successful',
              });
            } else {
              // one time subscription
              const subscriptionInformation =
                body.data as ChargeSuccessEventDto<{ plan_code: string }>;

              const user = await this.userQueryService.findOne(
                subscriptionInformation.customer.email,
              );

              // we currently only have monthly/quarterly plans
              const monthsToExpiration =
                subscriptionInformation.plan.interval === 'monthly' ? 1 : 3;

              const expiresOnDate = moment(new Date())
                .utc()
                .add(monthsToExpiration, 'month')
                .toDate();

              await this.createOneTimeSubscriptionHandler.handle({
                expiresOn: expiresOnDate,
                planCode: subscriptionInformation.metadata.plan_code,
                userId: user.id,
              });
            }
          }
          break;

        default:
          throw new HttpException(
            'Webhook event not implemented',
            HttpStatus.BAD_REQUEST,
          );
      }
    } catch (error) {
      throw new HttpException(
        'An error occured while processing payment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
