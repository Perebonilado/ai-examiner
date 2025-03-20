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

@Controller('call-credits')
export class CallCreditsController {
  constructor(
    @Inject(CreateCallCreditsHandler)
    private createCallCreditsHandler: CreateCallCreditsHandler,
    @Inject(CallCreditsQueryService)
    private callCreditsQueryService: CallCreditsQueryService,
    @Inject(PaystackCallCreditsService)
    private paystackCallCreditService: PaystackCallCreditsService,
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

      if (!callCredits) {
        const freeTimeMs = 180000; // 3mins in milliseconds
        const createdFreeCredits = await this.createCallCreditsHandler.handle({
          timeToAddMs: freeTimeMs,
          userId: userToken.sub,
        });

        return {
          remainingCredits: createdFreeCredits.data.reaminingCredits,
        };
      }

      return {
        remainingCredits: callCredits.remainingTimeMs,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to get call credits',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
