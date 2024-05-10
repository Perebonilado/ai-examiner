import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  UploadedFile,
  Get,
  UseGuards,
  Req,
  Param,
} from '@nestjs/common';
import { AIExaminerService } from 'src/integrations/open-ai/services/AIExaminerService';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { Request } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { GetAllQuestionsDto } from 'src/dto/GetAllQuestionsDto';
import { QuestionQueryService } from 'src/query/services/QuestionQueryService';
import { GetQuestionByIdDto } from 'src/dto/GetQuestionByIdDto';

@Controller('questions')
export class QuestionsController {
  constructor(
    @Inject(AIExaminerService) private aiExaminerService: AIExaminerService,
    @Inject(QuestionQueryService)
    private questionQueryService: QuestionQueryService,
  ) {}

  @UseGuards(AuthGuard)
  @Get('/:id')
  public async getQuestionById(@Param() params: GetQuestionByIdDto, @Req() request: Request) {
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

      return mappedQuestions;
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to find questions',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // @Post('/generate-mcq')
  // public async generateMCQQuestions(@UploadedFile() file: Express.Multer.File) {
  //   try {
  //     const questions =
  //       await this.aiExaminerService.generateMultipleChoiceQuestions({
  //         filePath:
  //           'https://keyvar-bucket.s3.eu-north-1.amazonaws.com/LOCAL-ANAESTHETICS-400LEVEL-LECTURE.pptx',
  //         examiner: {
  //           instructions: `You are a Medicine examiner in a university`,
  //           name: `Medicine examiner`,
  //         },
  //       });

  //     return questions;
  //   } catch (error) {
  //     console.log(error);
  //     throw new HttpException(
  //       'Something went wrong while generating mcq questions',
  //       HttpStatus.BAD_REQUEST,
  //     );
  //   }
  // }
}
