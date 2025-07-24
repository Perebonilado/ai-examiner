import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { Request } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { CreateCallCreditsHandler } from 'src/business/handlers/CallCredits/CreateCallCreditsHandler';
import { CallCreditsQueryService } from 'src/query/services/CallCreditsQueryService';
import { PaystackCallCreditsService } from 'src/integrations/paystack/services/PaystackCallCreditsService';
import { PurchaseCallCreditDto } from 'src/dto/PurchaseCallCreditDto';
import * as moment from 'moment';
import { UpdateCallCreditsHandler } from 'src/business/handlers/CallCredits/UpdateCallCreditsHandler';
import { SubscriptionQueryService } from 'src/query/services/SubscriptionQueryService';
import { PaystackSubscriptionService } from 'src/integrations/paystack/services/PaystackSubscriptionService';

@Controller('call-credits')
export class CallCreditsController {
  constructor(
    @Inject(CreateCallCreditsHandler)
    private createCallCreditsHandler: CreateCallCreditsHandler,
    @Inject(CallCreditsQueryService)
    private callCreditsQueryService: CallCreditsQueryService,
    @Inject(PaystackCallCreditsService)
    private paystackCallCreditService: PaystackCallCreditsService,
    @Inject(UpdateCallCreditsHandler)
    private updateCallCreditsHandler: UpdateCallCreditsHandler,
    @Inject(SubscriptionQueryService)
    private subscriptionQueryService: SubscriptionQueryService,
    @Inject(PaystackSubscriptionService)
    private paystackSubcriptionService: PaystackSubscriptionService,
  ) {}

  @UseGuards(AuthGuard)
  @Post('')
  public async initiateCallCreditPurchase(
    @Req() request: Request,
    @Body() body: PurchaseCallCreditDto,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const data =
        await this.paystackCallCreditService.createCallCreditsPayment({
          amount: `${body.amount}00`,
          currency: body.currency,
          email: userToken.email,
          timePurchasedMs: body.timeMs,
        });

      return {
        data,
        message: 'successful',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to initiate call credit purchase',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Get('')
  public async getCallCredits(@Req() request: Request) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const callCredits = await this.callCreditsQueryService.findByUserId(
        userToken.sub,
      );

      let freeTimeMs = 180000; // 3mins in milliseconds

      const userSubscription = await this.subscriptionQueryService.findByUserId(
        userToken.sub,
      );

      if (userSubscription) {
        const subInfo =
          await this.paystackSubcriptionService.fetchSubscriptionBySubscriptionCode(
            userSubscription.subscriptionCode,
          );

        if ((subInfo.planInformation.description.region as string).toLocaleLowerCase().includes('america')) {
          freeTimeMs = 3_600_000; // 1 hour
        }
      }

      if (!callCredits) {
        const createdFreeCredits = await this.createCallCreditsHandler.handle({
          timeToAddMs: freeTimeMs,
          userId: userToken.sub,
        });

        return {
          remainingCreditsMs:
            createdFreeCredits.data.remainingCreditsMs +
            createdFreeCredits.data.freeCredits,
          free: createdFreeCredits.data.freeCredits,
          paid: createdFreeCredits.data.remainingCreditsMs,
        };
      }

      const currentDateStartOfMonth = moment(new Date()).startOf('month');
      const lastFreeCreditUpdateStartOfMonth = moment(
        callCredits.lastFreeTimeModifiedOn,
      ).startOf('month');

      if (lastFreeCreditUpdateStartOfMonth.isBefore(currentDateStartOfMonth)) {
        await this.updateCallCreditsHandler.handle({
          action: 'add_reamining_time',
          freeCallCredits: freeTimeMs,
          freeCallCreditsModifiedOn: new Date(),
          timeToUpdate: 0,
          userId: userToken.sub,
        });
      }

      return {
        remainingCreditsMs:
          callCredits.remainingTimeMs + callCredits.freeRemainingTimeMs,
        free: callCredits.freeRemainingTimeMs,
        paid: callCredits.remainingTimeMs,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to get call credits',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
