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
import { InitiateSubscriptionDto } from 'src/dto/InitiateSubscriptionDto';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { CreateSubscriptionModel } from 'src/integrations/paystack/models/CreateSubscriptionModel';
import { DisableSubscriptionPayloadModel } from 'src/integrations/paystack/models/DisableSubscriptionModel';
import { EnableSubscriptionPayloadModel } from 'src/integrations/paystack/models/EnableSubscriptionModel';
import { PaystackSubscriptionService } from 'src/integrations/paystack/services/PaystackSubscriptionService';
import { SubscriptionQueryService } from 'src/query/services/SubscriptionQueryService';

@Controller('subscription')
export class SubscriptionController {
  constructor(
    @Inject(PaystackSubscriptionService)
    private paystackSubscriptionService: PaystackSubscriptionService,
    @Inject(SubscriptionQueryService)
    private subscriptionQueryService: SubscriptionQueryService,
  ) {}

  @UseGuards(AuthGuard)
  @Post('/initiate')
  public async initiateSubscription(
    @Req() request: Request,
    @Body() body: InitiateSubscriptionDto,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      let subscriptionProcessingInfo: CreateSubscriptionModel;

      const subscriptionDetails =
        await this.subscriptionQueryService.findByUserId(userToken.sub);

      if (!subscriptionDetails) {
        subscriptionProcessingInfo =
          await this.paystackSubscriptionService.createSubscription({
            email: userToken.email,
            plan: body.planId,
          });
      } else {
        const subscriptionInfo =
          await this.paystackSubscriptionService.fetchSubscriptionBySubscriptionCode(
            subscriptionDetails.subscriptionCode,
          );

        const userHasActiveSubscription =
          subscriptionInfo.subscrptionInformation.status === 'active';

        if (userHasActiveSubscription) {
          throw new HttpException(
            'Please, cancel your active subscription first',
            HttpStatus.BAD_REQUEST,
          );
        } else {
          subscriptionProcessingInfo =
            await this.paystackSubscriptionService.createSubscription({
              email: userToken.email,
              plan: body.planId,
            });
        }
      }

      return {
        data: subscriptionProcessingInfo,
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HttpException(
        error?.response ??
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
        error?.response ??
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
        error?.response ??
          'An Error occured while trying to restart your subscription',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Get('/details')
  public async getSubscriptionDetails(@Req() request: Request) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const subscription = await this.subscriptionQueryService.findByUserId(
        userToken.sub,
      );
      if (subscription) {
        const details =
          await this.paystackSubscriptionService.fetchSubscriptionBySubscriptionCode(
            subscription.subscriptionCode,
          );

        return details;
      }

      return {
        cardInformation: {
          accountName: null,
          bank: null,
          brand: null,
          expirationMonth: null,
          expirationYear: null,
          last4: null,
        },
        planInformation: {
          amount: null,
          currency: null,
          name: null,
          planCode: null,
        },
        subscrptionInformation: {
          code: null,
          token: null,
          status: null,
        },
      };
    } catch (error) {
      throw new HttpException(
        error?.response ??
          'An Error occured while trying to get your subscription information',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
