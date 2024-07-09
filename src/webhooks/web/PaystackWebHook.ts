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

@Controller('webhook/paystack')
export class PaystackWebhook {
  constructor(
    @Inject(CreateSubscriptionHandler)
    private createSubscriptionHandler: CreateSubscriptionHandler,
    @Inject(UserQueryService) private userQueryService: UserQueryService,
    private notificationsGateway: NotificationsGateway,
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
            const subscriptionData =
              body.data as ChargeSuccessEventDto;


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
