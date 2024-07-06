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
import { PaystackSubscriptionCreatedDto } from '../dto/PaystackSubscriptionCreatedDto';

@Controller('webhook/paystack')
export class PaystackWebhook {
  constructor(
    @Inject(CreateSubscriptionHandler)
    private createSubscriptionHandler: CreateSubscriptionHandler,
    @Inject(UserQueryService) private userQueryService: UserQueryService,
  ) {}

  @Post('')
  public async processPayments(
    @Res() response: Response,
    @Body() body: PaystackEventDto,
  ) {
    try {
      // acknowledge
      response.send(200);

      switch (body.event) {
        case 'subscription.create':
          {
            const subscriptionData =
              body.body as PaystackSubscriptionCreatedDto;

            const user = await this.userQueryService.findOne(
              subscriptionData.customer.email,
            );
            
            await this.createSubscriptionHandler.handle({
              payload: { subscriptionData, userId: user.id },
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
