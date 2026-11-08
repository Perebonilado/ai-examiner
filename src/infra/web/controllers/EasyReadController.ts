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
import { Request } from 'express';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { EasyReadAllowanceService } from '../services/EasyReadAllowanceService';

@Controller('easy-read')
export class EasyReadController {
  constructor(
    @Inject(EasyReadAllowanceService)
    private easyReadAllowanceService: EasyReadAllowanceService,
  ) {}

  /** The signed-in user's Easy Read allowance for this month. */
  @UseGuards(AuthGuard)
  @Get('allowance')
  public async getAllowance(@Req() request: Request) {
    const userToken = request['user'] as VerifiedTokenModel;
    return await this.easyReadAllowanceService.getAllowance(userToken.sub);
  }

  /** The app reports reading time while Easy Read is open and visible (free plan only). */
  @UseGuards(AuthGuard)
  @Post('usage')
  public async recordUsage(
    @Req() request: Request,
    @Body() body: { seconds?: unknown },
  ) {
    const seconds = Number(body?.seconds);
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new HttpException(
        'seconds must be a non-negative number',
        HttpStatus.BAD_REQUEST,
      );
    }
    const userToken = request['user'] as VerifiedTokenModel;
    return await this.easyReadAllowanceService.recordUsage(
      userToken.sub,
      seconds,
    );
  }
}
