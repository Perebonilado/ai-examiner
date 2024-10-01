import {
  Controller,
  Post,
  HttpException,
  HttpStatus,
  Inject,
  Req,
  Body,
  Param,
  UseGuards,
  Get,
} from '@nestjs/common';
import { Request } from 'express';
import { UpserQuestionProgressHandler } from 'src/business/handlers/QuestionProgress/UpsertQuestionProgressHandler';
import { UpsertQuestionProgressDTO } from 'src/dto/UpsertQuestionProgressDto';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { QuestionProgressQueryService } from 'src/query/services/QuestionProgressQueryService';

@Controller('question-progress')
export class QuestionProgressController {
  constructor(
    @Inject(UpserQuestionProgressHandler)
    private upsertQuestionProgressHandler: UpserQuestionProgressHandler,
    @Inject(QuestionProgressQueryService)
    private questionProgressQueryService: QuestionProgressQueryService
  ) {}

  @UseGuards(AuthGuard)
  @Post('/:questionId')
  public async upserQuestionProgress(
    @Body() payload: UpsertQuestionProgressDTO,
    @Param('questionId') questionId: string,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      
      return await this.upsertQuestionProgressHandler.handle({
        questionId,
        userId: userToken.sub,
        data: payload?.selectedQuestionId ? [{...payload}] : null,
      });
    } catch (error) {
      throw new HttpException(
        'An error occured while upserting progress',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Get('/:questionId')
  public async getProgressByQuestionId(@Param('questionId') questionId: string){
    try {
      return await this.questionProgressQueryService.findProgressByQuestionId(questionId)
    } catch (error) {
      throw new HttpException('Failed to get question progress', HttpStatus.BAD_REQUEST)
    }
  }
}
