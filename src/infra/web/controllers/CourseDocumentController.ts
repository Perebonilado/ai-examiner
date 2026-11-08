import { EasyReadAllowanceService } from '../services/EasyReadAllowanceService';
import { DocumentPdfService } from '../services/easy-read/DocumentPdfService';
import {
  EasyReadSimplificationService,
  SimplifiedPagesResponse,
} from '../services/easy-read/EasyReadSimplificationService';
import { parsePageList } from '../services/easy-read/pageWork';
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
import { Request, Response } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { CreateCourseDocumentDto } from 'src/dto/CreateCourseDocumentDto';
import { CourseDocumentQueryService } from 'src/query/services/CourseDocumentQueryService';
import { CreateQuestionHandler } from 'src/business/handlers/Question/CreateQuestionHandler';
import { ExaminerService } from 'src/integrations/open-ai/services/ExaminerService';
import { inactiveSubscriptionStatuses } from 'src/constants';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import {
  createSimplifiedPdf,
  extractJSONDataFromMessages,
  generateHTMLFromContent,
  PDFContent,
} from 'src/utils';
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
import { YoutubeKeywordsSchema } from 'src/schemas/YouTubeKeywordsSchema';
import {
  getGoogleImageQueryPrompt,
  YoutubeKeyWordPrompt,
} from 'src/constants/QuestionGenerationPromptV2';
import { YoutubeSearchService } from 'src/integrations/rapid/services/YoutubeSearchService';
import { YoutubeSearchModelRapid } from 'src/integrations/rapid/models/YoutubeSearch';
import { CreateRelatedVideoHandler } from 'src/business/handlers/RelatedVideo/CreateRelatedVideoHandler';
import { RelatedVideoQueryService } from 'src/query/services/RelatedVideoQueryService';
import { GoogleDriveService } from 'src/integrations/google/services/GoogleDriveService';
import { StoredFileQueryService } from 'src/query/services/StoredFileQueryService';
import { ExtractTextService } from 'src/integrations/text-extraction/services/ExtractTextService';
import { UpdateStoredFileHandler } from 'src/business/handlers/StoredFile/UpdateStoredFileHandler';
import { StoredFileUrlModel } from '../models/StoredFileModel';
import { FileConversionService } from 'src/integrations/aspose/services/FileConversionService';
import { ModifiedContentModel } from '../models/ModifiedContentModel';
import { GoogleSearchService } from 'src/integrations/google/services/GoogleSearchService';
import { GoogleImageSearchQuerySchema } from 'src/schemas/GoogleImageSearchQuerySchema';
import { GoogleImageSearchModel } from 'src/integrations/google/models/GoogleSearchModel';
import { GEMINI_CONN } from 'src/integrations/vercel-ai/services/GeminiConn';
import { CLAUDE_CONN } from 'src/integrations/vercel-ai/services/ClaudeConn';
import { AI } from 'src/integrations/vercel-ai/services/AI';
import { CreateSprintReadContentHandler } from 'src/business/handlers/StoredFile/CreateSprintReadContentHandler';

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
    @Inject(YoutubeSearchService)
    private youtubeSearchService: YoutubeSearchService,
    @Inject(CreateRelatedVideoHandler)
    private createRelatedVideoHandler: CreateRelatedVideoHandler,
    @Inject(RelatedVideoQueryService)
    private relatedVideoQueryService: RelatedVideoQueryService,
    @Inject(GoogleDriveService) private googleDriveService: GoogleDriveService,
    @Inject(StoredFileQueryService)
    private storedFileQueryService: StoredFileQueryService,
    @Inject(ExtractTextService) private extractTextService: ExtractTextService,
    @Inject(UpdateStoredFileHandler)
    private updateStoredFileHandler: UpdateStoredFileHandler,
    @Inject(FileConversionService)
    private fileConversionService: FileConversionService,
    @Inject(GoogleSearchService)
    private googleSearchService: GoogleSearchService,
    @Inject(GEMINI_CONN) private readonly geminiConn: AI,
    @Inject(CLAUDE_CONN) private readonly claudeConn: AI,
    @Inject(CreateSprintReadContentHandler)
    private createSprintReadContentHandler: CreateSprintReadContentHandler,
    @Inject(EasyReadAllowanceService)
    private easyReadAllowanceService: EasyReadAllowanceService,
    @Inject(DocumentPdfService)
    private documentPdfService: DocumentPdfService,
    @Inject(EasyReadSimplificationService)
    private easyReadSimplificationService: EasyReadSimplificationService,
  ) {}

  /** 404 unless the document belongs to the signed-in user. */
  private async assertOwnsDocument(documentId: string, userId: string) {
    const document =
      await this.courseDocumentQueryService.findCourseDocumentById(
        documentId,
        userId,
      );
    if (!document) {
      throw new HttpException('Document not found', HttpStatus.NOT_FOUND);
    }
    return document;
  }

  /**
   * Easy Read endpoints: the document must be the user's own, and free-plan users must have
   * Easy Read time left this month (403 EASY_READ_LIMIT_REACHED otherwise). Runs before any
   * file download or AI call.
   */
  private async assertCanOpenInEasyRead(documentId: string, request: Request) {
    const userToken = request['user'] as VerifiedTokenModel;
    await this.assertOwnsDocument(documentId, userToken.sub);
    await this.easyReadAllowanceService.assertCanUseEasyRead(userToken.sub);
  }

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
  @Get('/stored-file-information/:documentId')
  public async getStoredFileInformation(
    @Param('documentId') documentId: string,
  ): Promise<StoredFileUrlModel> {
    try {
      const storedFile =
        await this.storedFileQueryService.findByDocumentId(documentId);

      if (!storedFile || !storedFile?.originalFileId) {
        return {
          thumbnailUrl: null,
          iframUrl: null,
        };
      }

      const fileId = storedFile.originalFileId;
      return {
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}`,
        iframUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      };
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Failed to get stored file info',
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * The document as a PDF, for Easy Read's Original view. Cached by the browser (private,
   * keyed by the stored file), so reopening a document doesn't download it again. Non-PDF files
   * are converted on the fly and then stored as PDF once.
   */
  @UseGuards(AuthGuard)
  @Get('/original-document-file/:documentId')
  public async getOriginalDocumentFile(
    @Param('documentId') documentId: string,
    @Res() res: Response,
    @Req() request: Request,
  ) {
    await this.assertCanOpenInEasyRead(documentId, request);
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const storedFile =
        await this.storedFileQueryService.findByDocumentId(documentId);
      if (!storedFile?.originalFileId) {
        throw new HttpException(
          'Document file not found',
          HttpStatus.NOT_FOUND,
        );
      }

      const etag = `"${storedFile.originalFileId}"`;
      res.set({
        'Cache-Control': 'private, max-age=604800',
        ETag: etag,
      });
      if (request.headers['if-none-match'] === etag) {
        res.status(HttpStatus.NOT_MODIFIED).end();
        return;
      }

      const pdf = await this.documentPdfService.getPdf(storedFile);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="file.pdf"',
      });
      res.send(pdf);

      if (!this.documentPdfService.isPdf(storedFile)) {
        const document =
          await this.courseDocumentQueryService.findCourseDocumentById(
            documentId,
            userToken.sub,
          );
        void this.documentPdfService.persistAsPdf(
          storedFile,
          pdf,
          document?.title ?? 'document',
        );
      }
    } catch (error) {
      console.log(error);
      if (res.headersSent) return;
      throw new HttpException(
        error?.status === HttpStatus.NOT_FOUND
          ? 'Document file not found'
          : 'Failed to get original file',
        error?.status === HttpStatus.NOT_FOUND
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Easy Read's simplified pages, as they're ready. Starts simplifying (or moves the page being
   * read to the front) and returns at once with each page's status and the HTML of finished pages
   * the app doesn't have yet. The app asks again every couple of seconds until status is "ready".
   *   ?priority=<page being read>  &have=<pages the app already has, e.g. "1-4,7">
   */
  @UseGuards(AuthGuard)
  @Get('/simplified-pages/:documentId')
  public async getSimplifiedPages(
    @Param('documentId') documentId: string,
    @Query('priority') priority: string,
    @Query('have') have: string,
    @Req() request: Request,
  ): Promise<SimplifiedPagesResponse> {
    await this.assertCanOpenInEasyRead(documentId, request);
    const userToken = request['user'] as VerifiedTokenModel;
    const document =
      await this.courseDocumentQueryService.findCourseDocumentById(
        documentId,
        userToken.sub,
      );
    try {
      return await this.easyReadSimplificationService.getProgress(
        documentId,
        document?.title ?? 'document',
        Math.max(1, Number(priority) || 1),
        parsePageList(have, 100_000),
      );
    } catch (error) {
      console.log(error);
      throw new HttpException(
        error?.message ?? 'Failed to get simplified pages',
        error?.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** Every simplified page at once (older clients). Waits until all pages are done. */
  @UseGuards(AuthGuard)
  @Get('/modified-content/:documentId')
  public async getModifiedContent(
    @Param('documentId') documentId: string,
    @Req() request: Request,
  ): Promise<ModifiedContentModel> {
    await this.assertCanOpenInEasyRead(documentId, request);
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const document =
        await this.courseDocumentQueryService.findCourseDocumentById(
          documentId,
          userToken.sub,
        );
      const pages = await this.easyReadSimplificationService.getWholeDocument(
        documentId,
        document?.title ?? 'document',
      );
      const htmlContent = pages.map((content) =>
        generateHTMLFromContent([content]),
      );
      return {
        content: htmlContent,
        pageCount: htmlContent.length,
      };
    } catch (error) {
      console.log(error);
      throw new HttpException(
        error.message ?? 'Failed to get modified content',
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** The simplified document as a PDF. Waits until all pages are done. */
  @UseGuards(AuthGuard)
  @Get('/modified-document-file/:documentId')
  public async getModifiedDocumentFile(
    @Param('documentId') documentId: string,
    @Req() request: Request,
    @Res() res: Response,
  ) {
    await this.assertCanOpenInEasyRead(documentId, request);
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const document =
        await this.courseDocumentQueryService.findCourseDocumentById(
          documentId,
          userToken.sub,
        );
      const pages = await this.easyReadSimplificationService.getWholeDocument(
        documentId,
        document?.title ?? 'document',
      );
      const newPdf = await createSimplifiedPdf(
        pages.map((page) =>
          page.length
            ? page
            : ([{ text: 'Empty Page', type: 'paragraph' }] as PDFContent[]),
        ),
      );
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="file.pdf"',
      });
      res.send(newPdf);
      return;
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Failed to get modified file',
        error.status ?? HttpStatus.BAD_REQUEST,
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
  @Get('/sprint-read/:documentId')
  public async getSprintReadContent(
    @Param('documentId') documentId: string,
    @Req() request: Request,
  ) {
    const userToken = request['user'] as VerifiedTokenModel;
    await this.assertOwnsDocument(documentId, userToken.sub);
    const existingSprintRead =
      await this.storedFileQueryService.findByDocumentId(documentId);
    let content: string[];
    let totalPages: number;
    if (existingSprintRead.sprintReadContent) {
      const sprintReadContent = JSON.parse(
        existingSprintRead.sprintReadContent,
      ) as PDFContent[][];
      content = sprintReadContent.map((c) => {
        return generateHTMLFromContent([c]);
      });
      totalPages = sprintReadContent.length;
    } else {
      const createdSprintReadContent =
        await this.createSprintReadContentHandler.handle({ documentId });
      content = createdSprintReadContent.data.data.map((c) => {
        return generateHTMLFromContent([c]);
      });
      totalPages = createdSprintReadContent.data.data.length;
    }

    return {
      content,
      totalPages,
    };
  }

  @UseGuards(AuthGuard)
  @Get('/web-images/search/:documentId')
  public async searchWebImages(
    @Query('query') query: string,
    @Param('documentId') documentId: string,
  ) {
    try {
      let images: GoogleImageSearchModel[] = [];
      const summary =
        await this.documentSummaryQueryService.findByDocumentId(documentId);

      if (!summary?.summary) {
        images = await this.googleSearchService.imageSearch(query);
      } else {
        const modifiedSearchQuery = await this.getModifiedImageSearchQuery({
          query,
          summary: summary.summary,
        });

        images =
          await this.googleSearchService.imageSearch(modifiedSearchQuery);
      }

      return images;
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Error finding images',
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
      const relatedVideo =
        await this.relatedVideoQueryService.findByDocumentId(documentId);

      if (relatedVideo) {
        return JSON.parse(relatedVideo.data) as YoutubeSearchModelRapid[];
      }

      const summary =
        await this.documentSummaryQueryService.findByDocumentId(documentId);
      if (!summary?.summary) return [];
      const keywords = await this.getYoutubeKeywords(summary.summary);
      const results = await Promise.all(
        keywords.map((kw) => {
          return this.youtubeSearchService.search({ searchQuery: kw });
        }),
      );
      const flatResults: YoutubeSearchModelRapid[] = results.map(
        (res) => res[0],
      );

      const seenIds = new Set<string>();
      const uniqueResults: YoutubeSearchModelRapid[] = [];

      for (const res of flatResults) {
        const id = res.videoId;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          uniqueResults.push(res);
        }
      }

      await this.createRelatedVideoHandler.handle({
        data: uniqueResults,
        documentId: documentId,
        source: 'rapid_api_youtube_search',
      });

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
          startPage: null,
          endPage: null,
          shortDescription: null,
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

  private async getModifiedImageSearchQuery({
    query,
    summary,
  }: {
    query: string;
    summary: string;
  }) {
    try {
      const response = await this.claudeConn.generateObject({
        schemaName: 'modifiedQuery',
        schema: GoogleImageSearchQuerySchema,
        messages: [
          { role: 'system', content: getGoogleImageQueryPrompt(summary) },
          {
            role: 'user',
            content: query,
          },
        ],
      });

      return response.object.modifiedQuery;
    } catch (error) {
      throw new HttpException(
        error?.message ?? 'Failed to get query',
        error?.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async getYoutubeKeywords(summary: string) {
    try {
      const response = await this.claudeConn.generateObject({
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
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }
}
