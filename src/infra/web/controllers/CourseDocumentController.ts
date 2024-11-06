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
  Res,
  Put,
} from '@nestjs/common';
import { CreateCourseDocumentHandler } from 'src/business/handlers/CourseDocument/CreateCourseDocumentHandler';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { Request } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { CreateCourseDocumentDto } from 'src/dto/CreateCourseDocumentDto';
import { CourseDocumentQueryService } from 'src/query/services/CourseDocumentQueryService';
import { CreateQuestionHandler } from 'src/business/handlers/Question/CreateQuestionHandler';
import { ExaminerService } from 'src/integrations/open-ai/services/ExaminerService';
import {
  generateQuestionsPrompt,
  inactiveSubscriptionStatuses,
} from 'src/constants';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { extractJSONDataFromMessages } from 'src/utils';
import { CreateDocumentTopicHandler } from 'src/business/handlers/DocumentTopic/CreateDocumentTopicHandler';
import { CreateQuestionTopicHandler } from 'src/business/handlers/QuestionTopic/CreateQuestionTopicHandler';
import { DocumentTopicModel } from 'src/infra/db/models/DocumentTopicModel';
import { LookUpQueryService } from 'src/query/services/LookUpQueryService';
import { SubscriptionQueryService } from 'src/query/services/SubscriptionQueryService';
import { PaystackSubscriptionService } from 'src/integrations/paystack/services/PaystackSubscriptionService';
import { UpdateCourseDocumentHandler } from 'src/business/handlers/CourseDocument/UpdateCourseDocumentHandler';
import { UpdateCourseDocumentDto } from 'src/dto/UpdateCourseDocumentDto';
import { ThreadTypeModel } from '../models/ThreadTypeModel';
import { QuestionType } from '../models/QuestionTypeModel';

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
    @Inject(LookUpQueryService) private lookUpQueryService: LookUpQueryService,
    @Inject(SubscriptionQueryService)
    private subscriptionQueryService: SubscriptionQueryService,
    @Inject(PaystackSubscriptionService)
    private paystackSubscriptionService: PaystackSubscriptionService,
    @Inject(UpdateCourseDocumentHandler)
    private updateCourseDocumentHandler: UpdateCourseDocumentHandler,
    @Inject(LookUpQueryService)
    private lookupQueryService: LookUpQueryService,
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
  @Put('')
  public async updateCourseDocument(
    @Body() body: UpdateCourseDocumentDto,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      return await this.updateCourseDocumentHandler.handle({
        data: body,
        userId: userToken.sub,
      });
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to update Document',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('')
  public async createCourseDocumentAndGenerateQuestions(
    @Query('questionCount') questionCount: number,
    @Query('questionType') questionType: number,
    @Query('includeUseCases') includeUseCases: string,
    @Body()
    body: Omit<CreateCourseDocumentDto, 'userId' | 'threadId' | 'courseId'>,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;

      const subscriptionInfo = await this.subscriptionQueryService.findByUserId(
        userToken.sub,
      );

      let isUserOnFreePlan = true;

      if (subscriptionInfo?.subscriptionCode) {
        const subscriptionDetails =
          await this.paystackSubscriptionService.fetchSubscriptionBySubscriptionCode(
            subscriptionInfo?.subscriptionCode,
          );

        if (
          !inactiveSubscriptionStatuses.includes(
            subscriptionDetails.subscrptionInformation.status,
          )
        ) {
          isUserOnFreePlan = false;
        }
      }

      const assistantId = isUserOnFreePlan
        ? EnvironmentVariables.config.assistantIdFreePlan
        : EnvironmentVariables.config.assistantIdPaidPlan;

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

      const questionTypeName = await this.lookUpQueryService.findLookUpById(
        Number(questionType),
      );

      const threadIdToAttach: Record<ThreadTypeModel, string> = {
        mcqDirectThreadId: '',
        mcqUseCaseThreadId: '',
        flashCardThreadId: '',
        documentChatThreadId: '',
        multipleTrueFalseThreadId: '',
      };

      if (questionTypeName.title.toLowerCase() === 'multiple choice') {
        includeUseCases === 'true'
          ? (threadIdToAttach.mcqUseCaseThreadId = updatedThread.id)
          : (threadIdToAttach.mcqDirectThreadId = updatedThread.id);
      } else if (
        questionTypeName.title.toLowerCase() === 'multiple true-false'
      ) {
        threadIdToAttach.multipleTrueFalseThreadId = updatedThread.id;
      } else {
        threadIdToAttach.flashCardThreadId = updatedThread.id;
      }

      const createdDocument = await this.createCourseDocumentHander.handle({
        payload: {
          courseId: '',
          title: body.title,
          userId: userToken.sub,
          fileId: body.fileId,
          ...threadIdToAttach,
        },
      });

      // save all topics to the document topic table and save them in the createdDocumentTopics
      // in order to use the ids to save the question topics further down
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
        updatedThread.id,
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

      const desiredQuestionCount = questionCount || 5;
      let generatedQuestions = [];
      const MAX_RETRIES = 5; // Prevent infinite loops
      let retryCount = 0;

      while (
        generatedQuestions.length < desiredQuestionCount &&
        retryCount < MAX_RETRIES
      ) {
        const remainingCount = desiredQuestionCount - generatedQuestions.length;

        await this.examinerService.createThreadMessage(
          existingThread.id,
          generateQuestionsPrompt(
            remainingCount,
            body.selectedQuestionTopics || undefined,
            includeUseCases === 'true' ? true : false,
            questionTypeName.title as QuestionType,
          ),
        );

        const run = await this.examinerService.createRun(
          assistantId,
          existingThread.id,
        );

        const messages = await this.examinerService.retrieveThreadMessages(
          existingThread.id,
          run.id,
        );

        const newQuestions = extractJSONDataFromMessages(messages);

        if (newQuestions instanceof Array && newQuestions.length) {
          generatedQuestions = [...generatedQuestions, ...newQuestions];
        }

        retryCount++;
      }

      if (!generatedQuestions.length) {
        throw new HttpException(
          `Insufficient content in document to generate questions`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const createdQuestion = await this.createQuestionHandler.handle({
        payload: {
          courseDocumentId: createdDocument.data.id,
          data: generatedQuestions,
          userId: userToken.sub,
          questionTypeId: questionType,
        },
      });

      // check if there are selected question topics, if so, map using the document topic id and save
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
      const type = await this.lookUpQueryService.findLookUpById(questionType);

      return {
        status: HttpStatus.CREATED,
        message: 'Questions successfully generated for document',
        data: {
          documentId: createdDocument.data.id,
          questionId: createdQuestion.data.id,
          type: type.title,
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
