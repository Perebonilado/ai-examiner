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
  Param,
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
import {
  DifficultyType,
  generatePromptForQuestions,
} from 'src/constants/QuestionGenerationPrompt';
import { DocumentSummaryQueryService } from 'src/query/services/DocumentSummaryQueryService';
import { YoutubeService } from 'src/integrations/google/services/YoutubeService';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { YoutubeKeywordsSchema } from 'src/schemas/YouTubeKeywordsSchema';
import { YoutubeKeyWordPrompt } from 'src/constants/QuestionGenerationPromptV2';
import { YouTubeVideoItem } from 'src/integrations/google/models/YoutubeSearchModel';

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
    @Inject(DocumentSummaryQueryService)
    private documentSummaryQueryService: DocumentSummaryQueryService,
    @Inject(YoutubeService) private youtubeService: YoutubeService,
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
  @Get('/summary/:documentId')
  public async getDocumentSummary(@Param('documentId') documentId: string) {
    try {
      return await this.documentSummaryQueryService.findByDocumentId(
        documentId,
      );
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Error getting summary',
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Get('/youtube-search/:documentId')
  public async getRelevantYoutubeVideos(
    @Param('documentId') documentId: string,
  ) {
    try {
      const summary =
        await this.documentSummaryQueryService.findByDocumentId(documentId);
      const keywords = await this.getYoutubeKeywords(summary.summary);
      const results = await Promise.all(
        keywords.map((kw) => {
          return this.youtubeService.youtubeVideoSearch({
            maxResults: 5,
            query: kw,
          });
        }),
      );
      const flatResults = results.map((res) => res[0]);

      const seenIds = new Set<string>();
      const uniqueResults: YouTubeVideoItem[] = [];
      
      for (const res of flatResults) {
        const id = res.id.videoId;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          uniqueResults.push(res);
        }
      }
      
      return uniqueResults;
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Error getting relevant youtube videos',
        error.status ?? HttpStatus.BAD_REQUEST,
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
    @Query('difficulty') difficulty: DifficultyType = 'medium',
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
        documentChatThreadId: '',
        flashCardEasyThreadId: '',
        flashCardHardThreadId: '',
        flashCardMediumThreadId: '',
        mcqDirectEasyThreadId: '',
        mcqDirectHardThreadId: '',
        mcqDirectMediumThreadId: '',
        mcqUseCaseEasyThreadId: '',
        mcqUseCaseHardThreadId: '',
        mcqUseCaseMediumThreadId: '',
        multipleTrueFalseEasyThreadId: '',
        multipleTrueFalseHardThreadId: '',
        multipleTrueFalseMediumThreadId: '',
        oralQuestionThreadId: '',
      };

      if (questionTypeName.title.toLowerCase() === 'multiple choice') {
        if (includeUseCases === 'true') {
          switch (difficulty) {
            case 'easy': {
              threadIdToAttach.mcqUseCaseEasyThreadId = updatedThread.id;
            }
            case 'medium': {
              threadIdToAttach.mcqUseCaseMediumThreadId = updatedThread.id;
            }
            default: {
              threadIdToAttach.mcqUseCaseHardThreadId = updatedThread.id;
            }
          }
        } else {
          switch (difficulty) {
            case 'easy': {
              threadIdToAttach.mcqDirectEasyThreadId = updatedThread.id;
            }
            case 'medium': {
              threadIdToAttach.mcqDirectMediumThreadId = updatedThread.id;
            }
            default: {
              threadIdToAttach.mcqDirectHardThreadId = updatedThread.id;
            }
          }
        }
      } else if (
        questionTypeName.title.toLowerCase() === 'multiple true-false'
      ) {
        switch (difficulty) {
          case 'easy': {
            threadIdToAttach.multipleTrueFalseEasyThreadId = updatedThread.id;
          }
          case 'medium': {
            threadIdToAttach.multipleTrueFalseMediumThreadId = updatedThread.id;
          }
          default: {
            threadIdToAttach.multipleTrueFalseHardThreadId = updatedThread.id;
          }
        }
      } else if (questionTypeName.title.toLowerCase().includes('oral')) {
        threadIdToAttach.oralQuestionThreadId = updatedThread.id;
      } else {
        switch (difficulty) {
          case 'easy': {
            threadIdToAttach.flashCardEasyThreadId = updatedThread.id;
          }
          case 'medium': {
            threadIdToAttach.flashCardMediumThreadId = updatedThread.id;
          }
          default: {
            threadIdToAttach.flashCardHardThreadId = updatedThread.id;
          }
        }
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

      const desiredQuestionCount =
        (questionTypeName.title as QuestionType) === 'Oral (Viva)'
          ? 2
          : questionCount || 5;
      let generatedQuestions = [];
      const MAX_RETRIES = 10; // Prevent infinite loops
      let retryCount = 0;

      while (
        generatedQuestions.length < desiredQuestionCount &&
        retryCount < MAX_RETRIES
      ) {
        const remainingCount = desiredQuestionCount - generatedQuestions.length;

        await this.examinerService.createThreadMessage(
          existingThread.id,
          generatePromptForQuestions({
            questionCount: remainingCount,
            focusAreas: body.selectedQuestionTopics || undefined,
            includeCaseStudies: includeUseCases === 'true' ? true : false,
            questionType: questionTypeName.title as QuestionType,
            difficulty,
          }),
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
          difficulty,
          isCaseStudy: includeUseCases === 'true',
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

  private async getYoutubeKeywords(summary: string) {
    try {
      const openaiClient = createOpenAI({
        compatibility: 'strict',
        apiKey: EnvironmentVariables.config.openAiApiKey,
      });

      const response = await generateObject({
        model: openaiClient.responses('gpt-4o-mini'),
        maxRetries: 3,
        mode: 'json',
        schemaName: 'keywords',
        schema: YoutubeKeywordsSchema,
        messages: [
          { role: 'system', content: YoutubeKeyWordPrompt },
          {
            role: 'user',
            content: `
            **source text start**
            ${summary}
            **source text end**
            `,
          },
        ],
      });

      return response.object.keywords;
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Failed to get keywords',
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
