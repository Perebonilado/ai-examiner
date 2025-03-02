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
} from '@nestjs/common';
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
  generateQuestionsPrompt,
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
  generateOralExaminationPrompt,
  generatePromptForQuestions,
} from 'src/constants/QuestionGenerationPrompt';
import { VapiCallingService } from 'src/integrations/vapi/services/VapiCallingService';
import { UserQueryService } from 'src/query/services/UserQueryService';

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
          flashCardThreadId: null,
          mcqDirectThreadId: null,
          mcqUseCaseThreadId: null,
        },
      });

      return await this.createQuestionHandler.handle({
        payload: {
          courseDocumentId: newCourseDocument.data.id,
          data: question.questions,
          questionTypeId: question.typeId,
          userId: userToken.sub,
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

  //id refers to the course document id
  @UseGuards(AuthGuard)
  @Post('/:id/generate-questions')
  public async generateDocumentQuestions(
    @Param('id') id: string,
    @Req() request: Request,
    @Query('questionCount') questionCount: number,
    @Query('questionType') questionType: number,
    @Query('includeUseCases') includeUseCases: string,
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
          includeUseCases === 'true'
            ? (threadIdKey = 'mcqUseCaseThreadId')
            : (threadIdKey = 'mcqDirectThreadId');
        } else if (
          questionTypeName.title.toLowerCase() === 'multiple true-false'
        ) {
          threadIdKey = 'multipleTrueFalseThreadId';
        } else if (questionTypeName.title.toLowerCase().includes('oral')) {
          threadIdKey = 'oralQuestionThreadId';
        } else {
          threadIdKey = 'flashCardThreadId';
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

        const desiredQuestionCount = questionCount || 5;
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

          return {
            courseDocumentId: q.courseDocumentId,
            createdOn: q.createdOn,
            id: q.id,
            progressPercentage,
            count: questionCount,
            totalAnswered: `${totalAnswered}/${questionCount}`,
            status: progress?.status ?? null,
            score: q.score,
            topics: q.topics,
            type: q.type,
          };
        }),
      );

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
