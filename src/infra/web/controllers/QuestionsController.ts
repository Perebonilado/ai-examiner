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
  Query,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import * as moment from 'moment';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { Request } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { QuestionQueryService } from 'src/query/services/QuestionQueryService';
import { GetQuestionByIdDto } from 'src/dto/GetQuestionByIdDto';
import { extractQuestionsFromMessages } from 'src/utils';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { getGenerationPropmt } from 'src/constants';
import { CourseDocumentQueryService } from 'src/query/services/CourseDocumentQueryService';
import { ExaminerService } from 'src/integrations/open-ai/services/ExaminerService';
import { CreateQuestionHandler } from 'src/business/handlers/Question/CreateQuestionHandler';
import { GenerateCourseDocumentQuestionDto } from 'src/dto/GenerateCourseDocumentQuestionsDto';
import { CreateScoreHandler } from 'src/business/handlers/Score/CreateScoreHandler';
import { CreateScoreDto } from 'src/dto/CreateScoreDto';
import { ScoreQueryService } from 'src/query/services/ScoreQueryService';
import { UpdateScoreHandler } from 'src/business/handlers/Score/UpdateScoreHandler';

@Controller('questions')
export class QuestionsController {
  constructor(
    @Inject(QuestionQueryService)
    private questionQueryService: QuestionQueryService,
    @Inject(CourseDocumentQueryService)
    private courseDocumentQueryService: CourseDocumentQueryService,
    @Inject(ExaminerService) private examinerService: ExaminerService,
    @Inject(CreateQuestionHandler)
    private createQuestionHandler: CreateQuestionHandler,
    @Inject(CreateScoreHandler) private createScoreHandler: CreateScoreHandler,
    @Inject(ScoreQueryService) private scoreQueryService: ScoreQueryService,
    @Inject(UpdateScoreHandler) private updateScoreHandler: UpdateScoreHandler,
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

  //id refers to the course document id
  @UseGuards(AuthGuard)
  @Post('/:id/generate-questions')
  public async generateDocumentQuestions(
    @Param() params: GenerateCourseDocumentQuestionDto,
    @Req() request: Request,
    @Query('questionCount') questionCount: number,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const document =
        await this.courseDocumentQueryService.findCourseDocumentById(
          params.id,
          userToken.sub,
        );

      if (document) {
        const existingThread = await this.examinerService.findThread(
          document.openAiThreadId,
        );

        // check if vector store has expired, if so:
        // create new store, attach file and attach to thread
        if (
          !existingThread.tool_resources.file_search.vector_store_ids.length
        ) {
          const newVectorStore = await this.examinerService.createVectorStore(
            document.title,
          );
          const updatedVectorStore =
            await this.examinerService.attachFileToVectorStore(
              document.openAiFileId,
              newVectorStore.id,
            );

          await this.examinerService.attachVectorStoreToThread(
            existingThread.id,
            updatedVectorStore.id,
          );
        }

        await this.examinerService.createThreadMessage(
          existingThread.id,
          getGenerationPropmt(questionCount || 5),
        );

        await this.examinerService.createRun(
          EnvironmentVariables.config.assistantId,
          existingThread.id,
        );

        const messages = await this.examinerService.retrieveThreadMessages(
          existingThread.id,
        );

        const mostRecentlyGeneratedQuestions =
          extractQuestionsFromMessages(messages);

        return await this.createQuestionHandler.handle({
          payload: {
            courseDocumentId: document.id,
            data: mostRecentlyGeneratedQuestions,
            userId: userToken.sub,
          },
        });
      } else {
        throw new HttpException(
          'Course Document does not exist',
          HttpStatus.NOT_FOUND,
        );
      }
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to generate questions for document',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Get('')
  public async getAllUserQuestions(
    @Req() request: Request,
    @Query('courseDocumentId') courseDocumentId: string,
    @Query('page', ParseIntPipe) page: number,
    @Query('pageSize', ParseIntPipe) pageSize: number,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const questions =
        await this.questionQueryService.findAllQuestionsByDocumentIdAndUserId(
          courseDocumentId,
          userToken.sub,
          pageSize,
          page,
        );

      const mappedQuestions = questions.questions.map((q) => ({
        courseDocumentId: q.courseDocumentId,
        createdOn: q.createdOn,
        id: q.id,
        count: JSON.parse(q.data).length,
        score: q.score,
      }));

      return {
        data: mappedQuestions,
        meta: questions.meta,
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to find questions',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('/score')
  public async saveScore(
    @Body() payload: Omit<CreateScoreDto, 'userId'>,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;

      const scoreExists = await this.scoreQueryService.findScoreByQuestionId(
        payload.questionId,
      );

      if (scoreExists) {
        return await this.updateScoreHandler.handle({
          payload: {
            createdOn: moment(new Date()).utc().toDate(),
            id: scoreExists.id,
            score: payload.score,
          },
        });
      }

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
