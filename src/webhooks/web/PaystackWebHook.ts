import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { PaystackEventDto } from '../dto/PaystackEventDto';

@Controller('webhook/paystack')
export class PaystackWebhook {
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
            /* 
            check if there is an active subscription from subscriptions table
            if there is, call the update handler to update the subscription code
            if there isnt, create one 
            
            */
          }
          break;
      
        default:
          throw new HttpException('Webhook event not implemented', HttpStatus.BAD_REQUEST)
      }
    } catch (error) {
      throw new HttpException(
        'An error occured while processing payment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
