import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { DisableSubscriptionPayloadModel } from 'src/integrations/paystack/models/DisableSubscriptionModel';
import { EnableSubscriptionPayloadModel } from 'src/integrations/paystack/models/EnableSubscriptionModel';
import { PaystackSubscriptionService } from 'src/integrations/paystack/services/PaystackSubscriptionService';

@Controller('subscription')
export class SubscriptionController {
  constructor(
    @Inject(PaystackSubscriptionService)
    private paystackSubscriptionService: PaystackSubscriptionService,
  ) {}

  @UseGuards(AuthGuard)
  @Get('/initiate')
  public async initiateSubscription(
    @Req() request: Request,
    @Query('planId') plan: string,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;

      const subscriptionProcessingInfo =
        await this.paystackSubscriptionService.createSubscription({
          email: userToken.email,
          plan: plan,
        });

      return {
        data: subscriptionProcessingInfo,
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HttpException(
        'An Error occured while trying to create a subscription',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('/cancel')
  public async cancelSubscription(
    @Body() payload: DisableSubscriptionPayloadModel,
  ) {
    try {
      return await this.paystackSubscriptionService.disableSubscription(
        payload,
      );
    } catch (error) {
      throw new HttpException(
        'An Error occured while trying to cancel your subscription',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('/restart')
  public async restartSubscription(
    @Body() payload: EnableSubscriptionPayloadModel,
  ) {
    try {
      return await this.paystackSubscriptionService.enableSubscription(payload);
    } catch (error) {
      throw new HttpException(
        'An Error occured while trying to restart your subscription',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
