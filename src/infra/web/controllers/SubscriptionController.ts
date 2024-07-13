import {
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
import { PaystackSubscriptionService } from 'src/integrations/paystack/services/PaystackSubscriptionService';

@Controller('subscription')
export class SubscriptionController {
  constructor(
    @Inject(PaystackSubscriptionService)
    private paystackSubscriptionService: PaystackSubscriptionService,
  ) {}

  @UseGuards(AuthGuard)
  @Get('')
  public async createSubscription(
    @Req() request: Request,
    @Query('plan') plan: string,
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
}
