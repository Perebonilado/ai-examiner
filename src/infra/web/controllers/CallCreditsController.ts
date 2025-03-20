import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { Request } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { CreateCallCreditsHandler } from 'src/business/handlers/CallCredits/CreateCallCreditsHandler';
import { CallCreditsQueryService } from 'src/query/services/CallCreditsQueryService';

@Controller('call-credits')
export class CallCreditsController {
  constructor(
    @Inject(CreateCallCreditsHandler)
    private createCallCreditsHandler: CreateCallCreditsHandler,
    @Inject(CallCreditsQueryService)
    private callCreditsQueryService: CallCreditsQueryService,
  ) {}

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
