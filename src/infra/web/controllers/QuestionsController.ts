import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  Get,
  UseGuards,
  Req,
  Param,
} from '@nestjs/common';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { Request } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { GetAllQuestionsDto } from 'src/dto/GetAllQuestionsDto';
import { QuestionQueryService } from 'src/query/services/QuestionQueryService';
import { GetQuestionByIdDto } from 'src/dto/GetQuestionByIdDto';

@Controller('questions')
export class QuestionsController {
  constructor(
    @Inject(QuestionQueryService)
    private questionQueryService: QuestionQueryService,
  ) {}

  @UseGuards(AuthGuard)
  @Get('/:id')
  public async getQuestionById(
    @Param() params: GetQuestionByIdDto,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      return await this.questionQueryService.findQuestionsById(
        params.id,
        userToken.sub,
      );
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to find question by id ' + params.id,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Get('')
  public async getAllUserQuestions(
    @Req() request: Request,
    @Body() body: GetAllQuestionsDto,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const questions =
        await this.questionQueryService.findAllQUestionsByDocumentIdAndUserId(
          body.courseDocumentId,
          userToken.sub,
        );

      const mappedQuestions = questions.map((q) => ({
        courseDocumentId: q.courseDocumentId,
        createdOn: q.createdOn,
        id: q.id,
        count: JSON.parse(q.data).length,
      }));

      return {
        data: mappedQuestions,
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to find questions',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
