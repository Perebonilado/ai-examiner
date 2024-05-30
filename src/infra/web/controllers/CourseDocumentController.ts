import {
  Controller,
  Inject,
  Post,
  Body,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
  Get,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { CreateCourseDocumentHandler } from 'src/business/handlers/CourseDocument/CreateCourseDocumentHandler';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { Request } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { CreateCourseDocumentDto } from 'src/dto/CreateCourseDocumentDto';
import { CourseDocumentQueryService } from 'src/query/services/CourseDocumentQueryService';
import { CreateQuestionHandler } from 'src/business/handlers/Question/CreateQuestionHandler';
import { ExaminerService } from 'src/integrations/open-ai/services/ExaminerService';
import { generateQuestionsPrompt } from 'src/constants';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { extractJSONDataFromMessages } from 'src/utils';
import { CreateDocumentTopicHandler } from 'src/business/handlers/DocumentTopic/CreateDocumentTopicHandler';
import { CreateQuestionTopicHandler } from 'src/business/handlers/QuestionTopic/CreateQuestionTopicHandler';
import { DocumentTopicModel } from 'src/infra/db/models/DocumentTopicModel';

@Controller('course-document')
export class CourseDocumentController {
  constructor(
    @Inject(CreateCourseDocumentHandler)
    private createCourseDocumentHander: CreateCourseDocumentHandler,
    @Inject(CourseDocumentQueryService)
    private courseDocumentQueryService: CourseDocumentQueryService,
    @Inject(ExaminerService) private examinerService: ExaminerService,
    @Inject(CreateQuestionHandler)
    private createQuestionHandler: CreateQuestionHandler,
    @Inject(CreateDocumentTopicHandler)
    private createDocumentTopicHandler: CreateDocumentTopicHandler,
    @Inject(CreateQuestionTopicHandler)
    private createQuestionTopicHandler: CreateQuestionTopicHandler,
  ) {}

  @UseGuards(AuthGuard)
  @Get('')
  public async getAllCourseDocuments(
    @Req() request: Request,
    @Query('id') id: string,
    @Query('courseId') courseId: string,
    @Query('title') title: string,
    @Query('page', ParseIntPipe) page: number,
    @Query('pageSize', ParseIntPipe) pageSize: number,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const data =
        await this.courseDocumentQueryService.findAllUserCoursesDocuments(
          id ?? '',
          courseId ?? '',
          title ?? '',
          userToken.sub,
          pageSize,
          page,
        );

      return {
        data,
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to find Documents',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('')
  public async createCourseDocumentAndGenerateQuestions(
    @Query('questionCount') questionCount: number,
    @Body()
    body: Omit<CreateCourseDocumentDto, 'userId' | 'threadId' | 'courseId'>,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;

      const vectorStore = await this.examinerService.createVectorStore(
        body.title,
      );

      const updatedVectorStoreId =
        await this.examinerService.attachFileToVectorStore(
          body.fileId,
          vectorStore.id,
        );

      const thread = await this.examinerService.createThread();

      const updatedThread =
        await this.examinerService.attachVectorStoreToThread(
          thread.id,
          updatedVectorStoreId,
        );

      const createdDocument = await this.createCourseDocumentHander.handle({
        payload: {
          courseId: '',
          title: body.title,
          userId: userToken.sub,
          fileId: body.fileId,
          threadId: updatedThread.id,
        },
      });

      let createdDocumentTopics: DocumentTopicModel[] | null = null;

      if (body.topics && body.topics.length) {
        const mappedTopics = body.topics.map((topic) => ({
          title: topic,
          documentId: createdDocument.data.id,
          userId: userToken.sub,
        }));

        const createdDocumentTopicsResponse =
          await this.createDocumentTopicHandler.handle({
            payload: mappedTopics,
          });

        createdDocumentTopics = createdDocumentTopicsResponse.data.data;
      }

      const existingThread = await this.examinerService.findThread(
        createdDocument.data.threadId,
      );

      // check if vector store has expired, if so:
      // create new store, attach file and attach to thread
      if (!existingThread.tool_resources.file_search.vector_store_ids.length) {
        const newVectorStore = await this.examinerService.createVectorStore(
          document.title,
        );
        const updatedVectorStoreId =
          await this.examinerService.attachFileToVectorStore(
            createdDocument.data.fileId,
            newVectorStore.id,
          );

        await this.examinerService.attachVectorStoreToThread(
          existingThread.id,
          updatedVectorStoreId,
        );
      }

      await this.examinerService.createThreadMessage(
        existingThread.id,
        generateQuestionsPrompt(questionCount || 5, body.topics || undefined),
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

      const createdQuestion = await this.createQuestionHandler.handle({
        payload: {
          courseDocumentId: createdDocument.data.id,
          data: mostRecentlyGeneratedQuestions,
          userId: userToken.sub,
        },
      });

      if (
        body.selectedQuestionTopics &&
        body.selectedQuestionTopics.length &&
        createdDocumentTopics
      ) {
        const questionTopicsToCreate = createdDocumentTopics
          .filter((dt) => {
            return body.selectedQuestionTopics.some((sq) => dt.title === sq);
          })
          ?.map((dt) => ({
            documentTopicTitle: dt.title,
            documentTopicId: dt.id,
            questionId: createdQuestion.data.id,
          }));

        await this.createQuestionTopicHandler.handle({
          payload: questionTopicsToCreate,
        });
      }

      return {
        status: HttpStatus.CREATED,
        message: 'Questions successfully generated for document',
        data: {
          documentId: createdDocument.data.id,
          questionId: createdQuestion.data.id,
        },
      };
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to create document',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
