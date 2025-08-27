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
  Delete,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import * as moment from 'moment';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { Request } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { QuestionQueryService } from 'src/query/services/QuestionQueryService';
import { GetQuestionByIdDto } from 'src/dto/GetQuestionByIdDto';
import {
  extractJSONDataFromMessages,
  generateUUID,
  replaceAllSpacesInStringWithHyphen,
} from 'src/utils';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import {
  generateSourceInfoPrompt,
  inactiveSubscriptionStatuses,
} from 'src/constants';
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
import { SubscriptionQueryService } from 'src/query/services/SubscriptionQueryService';
import { PaystackSubscriptionService } from 'src/integrations/paystack/services/PaystackSubscriptionService';
import { DeleteQuestionHandler } from 'src/business/handlers/Question/DeleteQuestionHandler';
import { QuestionProgressQueryService } from 'src/query/services/QuestionProgressQueryService';
import { ThreadTypeModel } from '../models/ThreadTypeModel';
import { LookUpQueryService } from 'src/query/services/LookUpQueryService';
import { UpdateCourseDocumentHandler } from 'src/business/handlers/CourseDocument/UpdateCourseDocumentHandler';
import { CreateCourseDocumentHandler } from 'src/business/handlers/CourseDocument/CreateCourseDocumentHandler';
import { SaveSharedQuestionDto } from 'src/dto/SaveSharedQuestionDto';
import { QuestionType } from '../models/QuestionTypeModel';
import { QuestionSourceRequesDto } from 'src/dto/QuestionSourceRequestDto';
import {
  DifficultyType,
  generateOralExaminationPrompt,
  generatePromptForQuestions,
} from 'src/constants/QuestionGenerationPrompt';
import { VapiCallingService } from 'src/integrations/vapi/services/VapiCallingService';
import { UserQueryService } from 'src/query/services/UserQueryService';
import { QuestionProgressStatusType } from '../models/QuestionProgressStatusType';
import { OralQuestionAnalysisQueryService } from 'src/query/services/OralQuestionAnalysisQueryService';
import { GenerateQuestionDto } from 'src/dto/GenerateQuestionDto';
import { createOpenAI } from '@ai-sdk/openai';
import { PineconeChunkService } from 'src/integrations/pinecone/services/PineconeChunksService';
import { generateObject, generateText } from 'ai';
import { McqSchema } from 'src/schemas/McqSchema';
import { MCQModel } from 'src/integrations/open-ai/models/MCQModel';
import { MultipleTrueFalseSchema } from 'src/schemas/MultipleTrueFasleSchema';
import { FlashCardsSchema } from 'src/schemas/FlashCardSchema';
import { VivaSchema } from 'src/schemas/VivaSchema';
import { z } from 'zod';
import {
  generatePromptForQuestionsV2,
  getAnswerVariationRule,
} from 'src/constants/QuestionGenerationPromptV2';
import {
  generateEssayAnalysisPrompt,
  generateSourceInfoPromptV2,
} from 'src/constants/V2Prompts';
import { CallCreditsQueryService } from 'src/query/services/CallCreditsQueryService';
import { PreferredLanguageQueryService } from 'src/query/services/PreferredLanguageQueryService';
import { EssaySchema } from 'src/schemas/EssaySchema';
import { CreateEssayQuestionAnalysisHandler } from 'src/business/handlers/EssayQuestionAnalysis/CreateEssayQuestionAnalysisHandler';
import { UpdateEssayQuestionAnalysisHandler } from 'src/business/handlers/EssayQuestionAnalysis/UpdateEssayQuestionAnalysisHandler';
import { AnalyzeEssayTestDto } from 'src/dto/AnalyzeEssayTestDto';
import { UpdateEssayQuestionAnalysisRequest } from 'src/business/handlers/request/UpdateEssayQuestionAnalysisRequest';
import { EssayAnalysisSchema } from 'src/schemas/EssayAnalysisSchema';
import { EssayQuestionAnalysisStatus } from '../models/EssayQuestionAnalysisStatus';
import { EssayQuestionAnalysisQueryService } from 'src/query/services/EssayQuestionAnalysisQueryService';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

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
    @Inject(SubscriptionQueryService)
    private subscriptionQueryService: SubscriptionQueryService,
    @Inject(PaystackSubscriptionService)
    private paystackSubscriptionService: PaystackSubscriptionService,
    @Inject(DeleteQuestionHandler)
    private deleteQuestionHandler: DeleteQuestionHandler,
    @Inject(QuestionProgressQueryService)
    private questionProgressQueryService: QuestionProgressQueryService,
    @Inject(LookUpQueryService)
    private lookUpQueryService: LookUpQueryService,
    @Inject(UpdateCourseDocumentHandler)
    private updateCourseDocumentHandler: UpdateCourseDocumentHandler,
    @Inject(CreateCourseDocumentHandler)
    private createCourseDocumentHandler: CreateCourseDocumentHandler,
    @Inject(VapiCallingService) private vapiCallingService: VapiCallingService,
    @Inject(UserQueryService) private userQueryService: UserQueryService,
    @Inject(OralQuestionAnalysisQueryService)
    private oralQuestionAnalysisQueryService: OralQuestionAnalysisQueryService,
    @Inject(PineconeChunkService)
    private pineconeChunkService: PineconeChunkService,
    @Inject(CallCreditsQueryService)
    private callCreditsQueryService: CallCreditsQueryService,
    @Inject(CreateEssayQuestionAnalysisHandler)
    private createEssayQuestionAnalysisHandler: CreateEssayQuestionAnalysisHandler,
    @Inject(UpdateEssayQuestionAnalysisHandler)
    private updateEssayQuestionAnalysisHandler: UpdateEssayQuestionAnalysisHandler,
    @Inject(EssayQuestionAnalysisQueryService)
    private essayQuestionAnalysisQueryService: EssayQuestionAnalysisQueryService,
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
  @Get('/viva/call-recording/:id')
  public async getCallRecording(@Param('id') id: string) {
    try {
      const callInfo = await this.vapiCallingService.getCallInformation(id);

      return {
        callRecording: callInfo.artifact.recordingUrl,
      };
    } catch (error) {
      throw new HttpException(
        error ?? 'Failed to get call recording',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('/viva/start-call')
  public async initiateClientCall(
    @Body() body: { questionId: string; language?: string },
    @Req() request: Request,
  ) {
    const { questionId } = body;
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const user = await this.userQueryService.findById(userToken.sub);
      const analysisIsAvailable =
        await this.oralQuestionAnalysisQueryService.findByQuestionId(
          questionId,
        );

      if (analysisIsAvailable) {
        throw new HttpException(
          'Your test has already been analyzed, please reload the page',
          HttpStatus.BAD_REQUEST,
        );
      }
      const questions = await this.questionQueryService.findQuestionsById(
        questionId,
        userToken.sub,
      );
      const questionsToAsk = questions.questions.map(
        (q) => q.question,
      ) as string[];
      const callCredits = await this.callCreditsQueryService.findByUserId(
        userToken.sub,
      );

      return await this.vapiCallingService.createAssistantForClientCall({
        messageContent: generateOralExaminationPrompt(questionsToAsk),
        metadata: { customerEmail: user.email, questionId: questions.id },
        userName: user.firstName,
        maxDurationMs:
          callCredits.freeRemainingTimeMs + callCredits.remainingTimeMs,
        language: body?.language || 'english',
      });
    } catch (error) {
      throw new HttpException(
        error?.response ??
          'Failed to initiate viva call for question id ' + questionId,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('/start-viva/:id')
  public async startOralExamination(
    @Param('id') questionId: string,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const user = await this.userQueryService.findById(userToken.sub);
      const questions = await this.questionQueryService.findQuestionsById(
        questionId,
        userToken.sub,
      );
      const questionsToAsk = questions.questions.map(
        (q) => q.question,
      ) as string[];
      await this.vapiCallingService.initiateCall({
        messageContent: generateOralExaminationPrompt(questionsToAsk),
        metadata: { customerEmail: user.email, questionId: questions.id },
        userName: user.firstName,
        userPhoneNumber: '+2347081271903',
      });
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to start viva for question id ' + questionId,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('/shared/:id')
  public async getSharedQuestionById(@Param('id') id: string) {
    try {
      return await this.questionQueryService.findSharedQuestionById(id);
    } catch (error) {
      throw new HttpException(
        'Something went wrong while fetching questions',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('/shared/save')
  public async saveSharedQuestion(
    @Body() body: SaveSharedQuestionDto,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const question = await this.questionQueryService.findSharedQuestionById(
        body.questionId,
      );

      const newCourseDocument = await this.createCourseDocumentHandler.handle({
        payload: {
          fileId: question.fileId,
          title: question.documentTitle,
          userId: userToken.sub,
          courseId: null,
          documentChatThreadId: null,
          mcqDirectEasyThreadId: null,
          mcqDirectMediumThreadId: null,
          mcqDirectHardThreadId: null,

          mcqUseCaseEasyThreadId: null,
          mcqUseCaseMediumThreadId: null,
          mcqUseCaseHardThreadId: null,

          multipleTrueFalseEasyThreadId: null,
          multipleTrueFalseMediumThreadId: null,
          multipleTrueFalseHardThreadId: null,

          flashCardEasyThreadId: null,
          flashCardMediumThreadId: null,
          flashCardHardThreadId: null,

          oralQuestionThreadId: null,
        },
      });

      return await this.createQuestionHandler.handle({
        payload: {
          courseDocumentId: newCourseDocument.data.id,
          data: question.questions,
          questionTypeId: question.typeId,
          userId: userToken.sub,
          difficulty: question.difficulty,
          isCaseStudy: question.isCaseStudy,
        },
      });
    } catch (error) {
      throw new HttpException(
        'Failed to save shared question',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Delete('/:id')
  public async deleteQuestion(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      return await this.deleteQuestionHandler.handle({
        questionId: id,
        userId: userToken.sub,
      });
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to delete question by id ' + id,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('/source/:id')
  public async getQuestionSource(
    @Body() body: QuestionSourceRequesDto,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const document =
        await this.courseDocumentQueryService.findCourseDocumentById(
          id,
          userToken.sub,
        );

      const temporaryVectorStoreName = `${generateUUID()}_${new Date().getTime()}`;

      const temporaryVectorStore = await this.examinerService.createVectorStore(
        temporaryVectorStoreName,
      );

      const updatedVectorStoreId =
        await this.examinerService.attachFileToVectorStore(
          document.openAiFileId,
          temporaryVectorStore.id,
        );

      const thread = await this.examinerService.createThread();

      const updatedThread =
        await this.examinerService.attachVectorStoreToThread(
          thread.id,
          updatedVectorStoreId,
        );

      await this.examinerService.createThreadMessage(
        updatedThread.id,
        generateSourceInfoPrompt(body.question),
      );

      const run = await this.examinerService.createRun(
        EnvironmentVariables.config.assistantIdPaidPlan,
        updatedThread.id,
      );

      const messages = await this.examinerService.retrieveThreadMessages(
        updatedThread.id,
        run.id,
      );

      const sourceData = (messages.data[0].content[0] as any).text.value;

      return {
        data: sourceData,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to get question source',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('/source/:id/v2')
  public async getQuestionSourceV2(
    @Body() body: QuestionSourceRequesDto,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const relevantChunks =
        await this.pineconeChunkService.semanticChunkSearch(
          body.question,
          id,
          5,
        );

      const openai = createOpenAI({
        compatibility: 'strict',
        apiKey: EnvironmentVariables.config.openAiApiKey,
      });

      const { text } = await generateText({
        model: openai.responses('gpt-4o-mini'),
        maxRetries: 3,
        prompt: generateSourceInfoPromptV2(
          body.question,
          relevantChunks.join('\n'),
          'English',
        ),
      });

      return {
        data: text,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to get question source',
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
    @Query('includeUseCases') includeUseCases: string,
    @Query('difficulty') difficulty: DifficultyType = 'medium',
    @Body() body: GenerateCourseDocumentQuestionDto,
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

      const document =
        await this.courseDocumentQueryService.findCourseDocumentById(
          id,
          userToken.sub,
        );

      if (document) {
        let threadIdKey: ThreadTypeModel;

        const questionTypeName = await this.lookUpQueryService.findLookUpById(
          Number(questionType),
        );

        if (questionTypeName.title.toLowerCase() === 'multiple choice') {
          if (includeUseCases === 'true') {
            switch (difficulty) {
              case 'easy': {
                threadIdKey = 'mcqUseCaseEasyThreadId';
              }
              case 'medium': {
                threadIdKey = 'mcqUseCaseMediumThreadId';
              }
              default: {
                threadIdKey = 'mcqUseCaseHardThreadId';
              }
            }
          } else {
            switch (difficulty) {
              case 'easy': {
                threadIdKey = 'mcqDirectEasyThreadId';
              }
              case 'medium': {
                threadIdKey = 'mcqDirectMediumThreadId';
              }
              default: {
                threadIdKey = 'mcqDirectHardThreadId';
              }
            }
          }
        } else if (
          questionTypeName.title.toLowerCase() === 'multiple true-false'
        ) {
          switch (difficulty) {
            case 'easy': {
              threadIdKey = 'multipleTrueFalseEasyThreadId';
            }
            case 'medium': {
              threadIdKey = 'multipleTrueFalseMediumThreadId';
            }
            default: {
              threadIdKey = 'multipleTrueFalseHardThreadId';
            }
          }
        } else if (questionTypeName.title.toLowerCase().includes('oral')) {
          threadIdKey = 'oralQuestionThreadId';
        } else {
          switch (difficulty) {
            case 'easy': {
              threadIdKey = 'flashCardEasyThreadId';
            }
            case 'medium': {
              threadIdKey = 'flashCardMediumThreadId';
            }
            default: {
              threadIdKey = 'flashCardHardThreadId';
            }
          }
        }

        // check if thread exists

        let threadId = document[threadIdKey];

        // create thread if it does not exist and attach vector
        if (!threadId?.length) {
          const vectorStore = await this.examinerService.createVectorStore(
            document.title,
          );

          const updatedVectorStoreId =
            await this.examinerService.attachFileToVectorStore(
              document.openAiFileId,
              vectorStore.id,
            );

          const thread = await this.examinerService.createThread();

          const updatedThread =
            await this.examinerService.attachVectorStoreToThread(
              thread.id,
              updatedVectorStoreId,
            );

          threadId = updatedThread.id;

          // update course document

          await this.updateCourseDocumentHandler.handle({
            userId: userToken.sub,
            data: {
              id: document.id,
              [threadIdKey]: updatedThread.id,
            },
          });
        }

        const existingThread = await this.examinerService.findThread(threadId);

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
          const remainingCount =
            desiredQuestionCount - generatedQuestions.length;

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

        const createdQuestions = await this.createQuestionHandler.handle({
          payload: {
            courseDocumentId: document.id,
            data: generatedQuestions,
            userId: userToken.sub,
            questionTypeId: questionType,
            difficulty: difficulty,
            isCaseStudy: includeUseCases === 'true',
          },
        });

        if (body.topics && body.topics.length) {
          //topics have not been previously created if this is passed
          const mappedTopics = body.topics.map((topic) => ({
            title: topic,
            documentId: id,
            userId: userToken.sub,
            startPage: null,
            endPage: null,
            shortDescription: null,
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
            body.selectedQuestionTopics.length &&
            body.saveSelectedTopics
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

        return {
          id: createdQuestions.data.id,
          type: replaceAllSpacesInStringWithHyphen(
            questionTypeName.title.toLowerCase(),
          ),
        };
      } else {
        throw new HttpException(
          'Document does not exist',
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
  @Post('/:documentId/generate-questions/v2')
  public async generateQuestionsV2(
    @Body() body: GenerateQuestionDto,
    @Param('documentId') documentId: string,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;

      const openai = createOpenAI({
        compatibility: 'strict',
        apiKey: EnvironmentVariables.config.openAiApiKey,
      });
      // const google = createGoogleGenerativeAI({
      //   apiKey: EnvironmentVariables.config.geminiApiKey,
      // });
      const prevQuestionLimit = 20;
      const previousQuestions =
        await this.questionQueryService.findPreviousQuestionsByConfig(
          documentId,
          {
            difficulty: body.difficulty,
            includeCaseStudies: body.includeUseCases,
          },
          String(body.questionType),
          prevQuestionLimit,
        );

      let topicTitlesForVectorSearch: string[] = [];
      let topicPagesForVectorSearch: number[] = [];
      /**
       * use the selected topic ids for newer topics with page range
       * we use the selected quesiton topics which contain titles for backward compatibility for the mobile app
       */
      if (body.selectedTopicIds && body.selectedTopicIds.length) {
        for (const topicId of body.selectedTopicIds) {
          const topic =
            await this.documentTopicQueryService.findDocumentTopicById(topicId);
          if (topic.startPage && topic.endPage) {
            // get all the pages numbers from page range
            for (let i: number = topic.startPage; i <= topic.endPage; i++) {
              topicPagesForVectorSearch.push(i);
            }
          }
        }
      } else if (
        body.selectedQuestionTopics &&
        body.selectedQuestionTopics.length
      ) {
        topicTitlesForVectorSearch = body.selectedQuestionTopics;
      } else {
        const savedTopics =
          await this.documentTopicQueryService.findAllByDocumentTopicsByDocumentIdAndUserId(
            documentId,
            userToken.sub,
          );
        topicTitlesForVectorSearch = savedTopics.map((t) => t.title);
      }

      let retrievedChunks: string[] = [];

      if (topicPagesForVectorSearch.length) {
        retrievedChunks = await Promise.all(
          topicPagesForVectorSearch.map(async (page) => {
            const index = page - 1;
            return await this.pineconeChunkService.chunkByIndexSearch(
              index,
              documentId,
            );
          }),
        );
      } else if (topicTitlesForVectorSearch) {
        retrievedChunks = (
          await Promise.all(
            topicTitlesForVectorSearch.slice(0, 40).map((topic) => {
              return this.pineconeChunkService.semanticChunkSearch(
                topic,
                documentId,
              );
            }),
          )
        ).flat();
      }

      const shouldUseFileSearch = retrievedChunks.flatMap((c) => c).length < 1;

      if (shouldUseFileSearch) {
        return await this.generateQuestionsForDocumentUsingFileSearch(
          documentId,
          userToken,
          body.questionCount,
          body.questionType,
          body.includeUseCases === true ? 'true' : 'false',
          body.difficulty,
          {
            saveSelectedTopics: false,
            selectedQuestionTopics: body.selectedQuestionTopics,
            topics: body.topics,
          },
        );
      }

      if (body.title) {
        await this.updateCourseDocumentHandler.handle({
          data: { id: documentId, title: body.title },
          userId: userToken.sub,
        });
      }

      const chunks = retrievedChunks.flatMap((c) => c);

      if (chunks.length === 0) {
        throw new HttpException(
          'No relevant content chunks found for the specified topics',
          HttpStatus.BAD_REQUEST,
        );
      }

      const questionTypeName = await this.lookUpQueryService.findLookUpById(
        Number(body.questionType),
      );

      const totalQuestions = questionTypeName.title
        .toLowerCase()
        .includes('oral')
        ? 5
        : body.questionCount;
      const maxBatchSize = questionTypeName.title
        .toLowerCase()
        .includes('flash')
        ? 20
        : 5; // Max questions per API call

      // Determine the number of batches needed
      // We'll use either the number needed based on max batch size or the number of chunks,
      // whichever is smaller (to ensure each batch has at least one chunk)
      const batchCount = Math.min(
        Math.ceil(totalQuestions / maxBatchSize),
        chunks.length,
      );

      // Calculate questions per batch (distribute evenly)
      const questionsPerBatch = Array(batchCount).fill(
        Math.floor(totalQuestions / batchCount),
      );

      // Distribute remaining questions (if any)
      let remainingQuestions = totalQuestions % batchCount;
      for (let i = 0; i < remainingQuestions; i++) {
        questionsPerBatch[i]++;
      }

      // Calculate how many chunks each batch should get
      const chunksPerBatch = Math.floor(chunks.length / batchCount);
      const extraChunks = chunks.length % batchCount;

      const chunkBatches: string[] = Array.from(
        { length: batchCount },
        () => '',
      );

      // Distribute chunks evenly
      let chunkIndex = 0;
      for (let i = 0; i < batchCount; i++) {
        // Calculate how many chunks this batch should get
        const chunkCount = chunksPerBatch + (i < extraChunks ? 1 : 0);

        // Add chunks to this batch
        for (let j = 0; j < chunkCount; j++) {
          chunkBatches[i] += (chunkBatches[i] ? ', ' : '') + chunks[chunkIndex];
          chunkIndex++;
        }
      }

      const languageToUse = 'English';

      const questionPromises = questionsPerBatch.map((batchSize, index) =>
        generateObject({
          // model: google('gemini-1.5-flash'),
          model: openai.responses('gpt-4o-mini'),
          maxRetries: 3,
          mode: 'json',
          schemaName: 'Questions',
          schemaDescription: 'Questions from study document',
          temperature: 0.8,
          topP: 0.7,
          schema: z.object({
            questions: z
              .array(
                this.getZodQuestionValidator(
                  questionTypeName.title.toLowerCase(),
                ),
              )
              .describe(
                getAnswerVariationRule(questionTypeName.title as QuestionType),
              ),
          }),
          prompt: generatePromptForQuestionsV2({
            difficulty: body.difficulty,
            includeCaseStudies: body.includeUseCases,
            questionCount: batchSize,
            questionType: questionTypeName.title as QuestionType,
            sourceText: chunkBatches[index],
            previousQuestions,
            preferredLanguage: languageToUse,
          }),
        }),
      );

      // Wait for all requests to complete
      const results = await Promise.all(questionPromises);
      const generatedQuestions: MCQModel[] = [];

      results.forEach((r) => {
        if (r.object.questions) {
          const mapped = r.object.questions.map((q) => ({
            ...q,
            id: generateUUID(), // Assign a unique ID
          })) as MCQModel[];
          generatedQuestions.push(...mapped);
        }
      });

      // Save generated questions
      const createdQuestions = await this.createQuestionHandler.handle({
        payload: {
          courseDocumentId: documentId,
          data: generatedQuestions,
          userId: userToken.sub,
          questionTypeId: questionTypeName.id,
          difficulty: body.difficulty,
          isCaseStudy: body.includeUseCases,
        },
      });

      return {
        id: createdQuestions.data.id,
        type: replaceAllSpacesInStringWithHyphen(
          questionTypeName.title.toLowerCase(),
        ),
      };
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
    @Query('showOralQuestions') showOralQuestions = '0',
    @Query('showEssayQuestions') showEssayQuestions = '0',
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

      const mappedQuestions = await Promise.all(
        questions.questions.map(async (q) => {
          const questionCount = JSON.parse(q.data).length;
          const progress =
            await this.questionProgressQueryService.findProgressByQuestionId(
              q.id,
            );
          let progressPercentage: number | null = null;
          let totalAnswered: number = 0;

          if (progress?.data && progress.data.length) {
            progressPercentage = (progress.data.length / questionCount) * 100;
            totalAnswered = Array.from(
              new Set(progress.data.map((d) => d.selectedQuestionId)),
            ).length;
          }

          let status: QuestionProgressStatusType = null;

          const questionTypes =
            await this.lookUpQueryService.findAllLookUpsByType('question_type');
          const oralQuestionId = questionTypes?.find((qt) =>
            qt.title.toLowerCase().includes('oral'),
          );
          const essayQuestionId = questionTypes?.find((qt) =>
            qt.title.toLowerCase().includes('essay'),
          );

          if (q.questionTypeId === oralQuestionId?.id) {
            const analysis =
              await this.oralQuestionAnalysisQueryService.findByQuestionId(
                q.id,
              );
            if (analysis && analysis.analysisData?.length) {
              status = 'submitted';
            }
          } else if (q.questionTypeId === essayQuestionId?.id) {
            const analysis =
              await this.essayQuestionAnalysisQueryService.findByQuestionId(
                q.id,
              );
            if (analysis && analysis.length) {
              status = 'submitted';
            }
          } else {
            status = progress?.status ?? null;
          }

          return {
            courseDocumentId: q.courseDocumentId,
            createdOn: q.createdOn,
            id: q.id,
            progressPercentage,
            count: questionCount,
            totalAnswered: `${totalAnswered}/${questionCount}`,
            status,
            score: q.score,
            topics: q.topics,
            type: q.type,
          };
        }),
      );

      let filteredQuestions = mappedQuestions;

      if (Number(showOralQuestions) !== 1) {
        filteredQuestions = mappedQuestions.filter((q) => {
          return !q.type.toLowerCase().includes('oral');
        });
      }

      if (Number(showEssayQuestions) !== 1) {
        filteredQuestions = mappedQuestions.filter((q) => {
          return !q.type.toLowerCase().includes('essay');
        });
      }

      return {
        data: {
          data: filteredQuestions,
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

  @UseGuards(AuthGuard)
  @Get('/essay-analysis/:questionId')
  public async getAnalyzedQuestion(@Param('questionId') questionId: string) {
    try {
      const data =
        await this.essayQuestionAnalysisQueryService.findByQuestionId(
          questionId,
        );

      if (data) {
        return {
          data,
        };
      }

      return {
        data: null,
      };
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Failed to get graded essay',
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('/essay-analysis')
  public async analyzeEssayQuestion(
    @Body() body: AnalyzeEssayTestDto,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const stagedForAnalysis: UpdateEssayQuestionAnalysisRequest[] = [];
      const question = await this.questionQueryService.findQuestionsById(
        body.questionId,
        userToken.sub,
      );
      for (const data of body.data) {
        const saved = await this.createEssayQuestionAnalysisHandler.handle({
          analysis: '',
          question: data.question,
          answer: data.answer,
          questionId: body.questionId,
          score: null,
          status: 'in-progress',
        });

        stagedForAnalysis.push({
          analysis: '',
          id: saved.data.id,
          score: null,
          status: 'in-progress',
          answer: data.answer,
          question: data.question,
        });
      }

      // analyze test
      const openai = createOpenAI({
        compatibility: 'strict',
        apiKey: EnvironmentVariables.config.openAiApiKey,
      });

      const toBeGraded = stagedForAnalysis.map(async (staged) => {
        if (!staged.answer.trim().length) {
          return {
            ...staged,
            score: 0,
            analysis: 'no answer given',
            status: 'complete',
          };
        }

        const chunks = await this.pineconeChunkService.semanticChunkSearch(
          staged.question,
          question.documentId,
          20,
        );

        const joinedChunk = chunks.join('\n');

        const analyzed = await generateObject({
          model: openai.responses('gpt-4o-mini'),
          maxRetries: 3,
          mode: 'json',
          schemaName: 'Analysis',
          schemaDescription: 'Analysis for student response',
          schema: EssayAnalysisSchema,
          prompt: generateEssayAnalysisPrompt({
            question: staged.question,
            sourceText: joinedChunk,
            answer: staged.answer,
          }),
        });

        staged.analysis = analyzed.object.analysis;
        staged.score = analyzed.object.score;
        staged.status = 'complete';

        return staged;
      });

      const graded = await Promise.all(toBeGraded);

      // update the stuff

      await Promise.all(
        graded.map(async (gr) => {
          return this.updateEssayQuestionAnalysisHandler.handle({
            analysis: gr.analysis,
            answer: gr.answer,
            id: gr.id,
            question: gr.question,
            score: gr.score,
            status: gr.status as EssayQuestionAnalysisStatus,
          });
        }),
      );

      return {
        status: HttpStatus.CREATED,
        message: 'Grading done',
        data: null,
      };
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Failed to analyze essay test',
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }

  private getZodQuestionValidator(questionTypeTitle: string) {
    switch (questionTypeTitle.toLowerCase()) {
      case 'multiple choice': {
        return McqSchema;
      }
      case 'multiple true-false': {
        return MultipleTrueFalseSchema;
      }
      case 'flash cards': {
        return FlashCardsSchema;
      }
      case 'essay': {
        return EssaySchema;
      }
      default: {
        return VivaSchema;
      }
    }
  }

  public async generateQuestionsForDocumentUsingFileSearch(
    id: string,
    userToken: VerifiedTokenModel,
    questionCount: number,
    questionType: number,
    includeUseCases: string,
    difficulty: DifficultyType,
    body: GenerateCourseDocumentQuestionDto,
  ) {
    try {
      const subscriptionInfo = await this.subscriptionQueryService.findByUserId(
        userToken.sub,
      );
      let isUserOnFreePlan = true;

      if (subscriptionInfo?.subscriptionCode) {
        const subscriptionDetails =
          await this.paystackSubscriptionService.fetchSubscriptionBySubscriptionCode(
            subscriptionInfo.subscriptionCode,
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

      const document =
        await this.courseDocumentQueryService.findCourseDocumentById(
          id,
          userToken.sub,
        );
      if (!document) {
        throw new HttpException(
          'Document does not exist',
          HttpStatus.NOT_FOUND,
        );
      }

      let threadIdKey: ThreadTypeModel;
      const questionTypeName = await this.lookUpQueryService.findLookUpById(
        Number(questionType),
      );
      const questionTitle = questionTypeName.title.toLowerCase();

      if (questionTitle === 'multiple choice') {
        threadIdKey =
          includeUseCases === 'true'
            ? difficulty === 'easy'
              ? 'mcqUseCaseEasyThreadId'
              : difficulty === 'medium'
                ? 'mcqUseCaseMediumThreadId'
                : 'mcqUseCaseHardThreadId'
            : difficulty === 'easy'
              ? 'mcqDirectEasyThreadId'
              : difficulty === 'medium'
                ? 'mcqDirectMediumThreadId'
                : 'mcqDirectHardThreadId';
      } else if (questionTitle === 'multiple true-false') {
        threadIdKey =
          difficulty === 'easy'
            ? 'multipleTrueFalseEasyThreadId'
            : difficulty === 'medium'
              ? 'multipleTrueFalseMediumThreadId'
              : 'multipleTrueFalseHardThreadId';
      } else if (questionTitle.includes('oral')) {
        threadIdKey = 'oralQuestionThreadId';
      } else {
        threadIdKey =
          difficulty === 'easy'
            ? 'flashCardEasyThreadId'
            : difficulty === 'medium'
              ? 'flashCardMediumThreadId'
              : 'flashCardHardThreadId';
      }

      let threadId = document[threadIdKey];
      if (!threadId?.length) {
        const vectorStore = await this.examinerService.createVectorStore(
          document.title,
        );
        const updatedVectorStoreId =
          await this.examinerService.attachFileToVectorStore(
            document.openAiFileId,
            vectorStore.id,
          );
        const thread = await this.examinerService.createThread();
        const updatedThread =
          await this.examinerService.attachVectorStoreToThread(
            thread.id,
            updatedVectorStoreId,
          );
        threadId = updatedThread.id;

        await this.updateCourseDocumentHandler.handle({
          userId: userToken.sub,
          data: { id: document.id, [threadIdKey]: updatedThread.id },
        });
      }

      const existingThread = await this.examinerService.findThread(threadId);
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

      const desiredQuestionCount =
        questionTitle === 'oral (viva)' ? 2 : questionCount || 5;
      let generatedQuestions = [];
      const MAX_RETRIES = 10;
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
            includeCaseStudies: includeUseCases === 'true',
            questionType: questionTitle as QuestionType,
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

      const createdQuestions = await this.createQuestionHandler.handle({
        payload: {
          courseDocumentId: document.id,
          data: generatedQuestions,
          userId: userToken.sub,
          questionTypeId: questionType,
          difficulty,
          isCaseStudy: includeUseCases === 'true',
        },
      });

      if (body.topics && body.topics.length) {
        const mappedTopics = body.topics.map((topic) => ({
          title: topic,
          documentId: id,
          userId: userToken.sub,
          startPage: null,
          endPage: null,
          shortDescription: null,
        }));

        const createdDocumentTopics =
          await this.createDocumentTopicHandler.handle({
            payload: mappedTopics,
          });

        const questionTopicsToCreate = createdDocumentTopics.data.data
          .filter((dt) => body.selectedQuestionTopics.includes(dt.title))
          .map((dt) => ({
            documentTopicTitle: dt.title,
            documentTopicId: dt.id,
            questionId: createdQuestions.data.id,
          }));

        await this.createQuestionTopicHandler.handle({
          payload: questionTopicsToCreate,
        });
      } else if (
        body.selectedQuestionTopics?.length &&
        body.saveSelectedTopics
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

      return {
        id: createdQuestions.data.id,
        type: replaceAllSpacesInStringWithHyphen(questionTitle),
      };
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to generate questions for document',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
