import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CreateScoreHandler } from 'src/business/handlers/Score/CreateScoreHandler';
import { CreateScoreDto } from 'src/dto/CreateScoreDto';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';

@Controller('score')
export class ScoreController {
  constructor(
    @Inject(CreateScoreHandler) private createScoreHandler: CreateScoreHandler,
  ) {}

  @UseGuards(AuthGuard)
  @Post('')
  public async saveScore(
    @Body() payload: Omit<CreateScoreDto, 'userId'>,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      return await this.createScoreHandler.handle({
        payload: {
          documentId: payload.documentId,
          questionId: payload.questionId,
          score: payload.score,
          userId: userToken.sub,
        },
      });
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to save score',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
