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
import { extractJSONDataFromMessages } from 'src/utils';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { generateQuestionsPrompt } from 'src/constants';
import { CourseDocumentQueryService } from 'src/query/services/CourseDocumentQueryService';
import { ExaminerService } from 'src/integrations/open-ai/services/ExaminerService';
import { CreateQuestionHandler } from 'src/business/handlers/Question/CreateQuestionHandler';
import { GenerateCourseDocumentQuestionDto } from 'src/dto/GenerateCourseDocumentQuestionsDto';
import { CreateScoreHandler } from 'src/business/handlers/Score/CreateScoreHandler';
import { CreateScoreDto } from 'src/dto/CreateScoreDto';
import { ScoreQueryService } from 'src/query/services/ScoreQueryService';
import { UpdateScoreHandler } from 'src/business/handlers/Score/UpdateScoreHandler';
import { DocumentTopicQueryService } from 'src/query/services/DocumentTopicQueryService';
import { CreateDocumentTopicHandler } from 'src/business/handlers/DocumentTopic/CreateDocumentTopicHandler';
import { CreateQuestionTopicHandler } from 'src/business/handlers/QuestionTopic/CreateQuestionTopicHandler';

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
    @Inject(DocumentTopicQueryService)
    private documentTopicQueryService: DocumentTopicQueryService,
    @Inject(CreateDocumentTopicHandler)
    private createDocumentTopicHandler: CreateDocumentTopicHandler,
    @Inject(CreateQuestionTopicHandler)
    private createQuestionTopicHandler: CreateQuestionTopicHandler,
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
    @Param('id') id: string,
    @Req() request: Request,
    @Query('questionCount') questionCount: number,
    @Query('questionType') questionType: number,
    @Body() body: GenerateCourseDocumentQuestionDto,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const document =
        await this.courseDocumentQueryService.findCourseDocumentById(
          id,
          userToken.sub,
        );

      if (document) {
        const existingThread = await this.examinerService.findThread(
          document.openAiThreadId,
        );

        // check if vector store has expired, if so:
        // create new store, attach file and attach to thread
        
        const vectorStore = await this.examinerService.retrieveVectorStore(
          existingThread.tool_resources.file_search.vector_store_ids[0],
        );
        if (vectorStore.status === 'expired') {
          const newVectorStore = await this.examinerService.createVectorStore(
            document.title,
          );
          const updatedVectorStoreId =
            await this.examinerService.attachFileToVectorStore(
              document.openAiFileId,
              newVectorStore.id,
            );

          await this.examinerService.attachVectorStoreToThread(
            existingThread.id,
            updatedVectorStoreId,
          );
        }

        await this.examinerService.createThreadMessage(
          existingThread.id,
          generateQuestionsPrompt(
            questionCount || 5,
            body.selectedQuestionTopics,
          ),
        );

        const run = await this.examinerService.createRun(
          EnvironmentVariables.config.assistantId,
          existingThread.id,
        );

        const messages = await this.examinerService.retrieveThreadMessages(
          existingThread.id,
          run.id,
        );

        const mostRecentlyGeneratedQuestions =
          extractJSONDataFromMessages(messages);

        const createdQuestions = await this.createQuestionHandler.handle({
          payload: {
            courseDocumentId: document.id,
            data: mostRecentlyGeneratedQuestions,
            userId: userToken.sub,
            questionTypeId: questionType,
          },
        });

        if (body.topics && body.topics.length) {
          //topics have not been previously created if this is passed
          const mappedTopics = body.topics.map((topic) => ({
            title: topic,
            documentId: id,
            userId: userToken.sub,
          }));

          const createdDocumentTopics =
            await this.createDocumentTopicHandler.handle({
              payload: mappedTopics,
            });

          const questionTopicsToCreate = createdDocumentTopics.data.data
            .filter((dt) => {
              return body.selectedQuestionTopics.some((sq) => dt.title === sq);
            })
            ?.map((dt) => ({
              documentTopicTitle: dt.title,
              documentTopicId: dt.id,
              questionId: createdQuestions.data.id,
            }));

          await this.createQuestionTopicHandler.handle({
            payload: questionTopicsToCreate,
          });
        } else {
          if (
            body.selectedQuestionTopics &&
            body.selectedQuestionTopics.length
          ) {
            const questionTopicsToCreate = await Promise.all(
              body.selectedQuestionTopics.map(async (t) => {
                const topic =
                  await this.documentTopicQueryService.findDocumentTopicsByTitleAndDocumentId(
                    t,
                    document.id,
                  );

                return {
                  documentTopicTitle: topic.title,
                  documentTopicId: topic.id,
                  questionId: createdQuestions.data.id,
                };
              }),
            );

            await this.createQuestionTopicHandler.handle({
              payload: questionTopicsToCreate,
            });
          }
        }

        return createdQuestions;
      } else {
        throw new HttpException(
          'Document does not exist',
          HttpStatus.NOT_FOUND,
        );
      }
    } catch (error) {
      console.log(error);
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

      const document =
        await this.courseDocumentQueryService.findCourseDocumentById(
          courseDocumentId,
          userToken.sub,
        );

      const mappedQuestions = questions.questions.map((q) => ({
        courseDocumentId: q.courseDocumentId,
        createdOn: q.createdOn,
        id: q.id,
        count: JSON.parse(q.data).length,
        score: q.score,
        topics: q.topics,
        type: q.type,
      }));

      return {
        data: {
          data: mappedQuestions,
          fileId: document.openAiFileId,
        },
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
