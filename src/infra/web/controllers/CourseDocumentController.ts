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
import {
  googlePresentationFileFormat,
  inactiveSubscriptionStatuses,
  pdfMimeType,
} from 'src/constants';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import {
  createSimplifiedPdf,
  extractJSONDataFromMessages,
  extractPagesTextsFromPDF,
  generateHTMLFromContent,
  PDFContent,
  splitPdfPagesToIndividualFiles,
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
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { YoutubeKeywordsSchema } from 'src/schemas/YouTubeKeywordsSchema';
import {
  getGoogleImageQueryPrompt,
  getTextSimplificationPrompt,
  YoutubeKeyWordPrompt,
} from 'src/constants/QuestionGenerationPromptV2';
import { YoutubeSearchService } from 'src/integrations/rapid/services/YoutubeSearchService';
import { YoutubeSearchModelRapid } from 'src/integrations/rapid/models/YoutubeSearch';
import { CreateRelatedVideoHandler } from 'src/business/handlers/RelatedVideo/CreateRelatedVideoHandler';
import { RelatedVideoQueryService } from 'src/query/services/RelatedVideoQueryService';
import { GoogleDriveService } from 'src/integrations/google/services/GoogleDriveService';
import { SimplifiedPDFArraySchema } from 'src/schemas/SimplifiedPDFSchema';
import { DocumentFileModel } from '../models/DocumentFileModel';
import { StoredFileQueryService } from 'src/query/services/StoredFileQueryService';
import { ExtractTextService } from 'src/integrations/text-extraction/services/ExtractTextService';
import { UpdateStoredFileHandler } from 'src/business/handlers/StoredFile/UpdateStoredFileHandler';
import { StoredFileUrlModel } from '../models/StoredFileModel';
import { FileConversionService } from 'src/integrations/aspose/services/FileConversionService';
import { ExportFormat } from 'asposeslidescloud';
import { ModifiedContentModel } from '../models/ModifiedContentModel';
import { GoogleSearchService } from 'src/integrations/google/services/GoogleSearchService';
import { GoogleImageSearchQuerySchema } from 'src/schemas/GoogleImageSearchQuerySchema';
import { GoogleImageSearchModel } from 'src/integrations/google/models/GoogleSearchModel';

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

  @UseGuards(AuthGuard)
  @Get('/original-document-file/:documentId')
  public async getOriginalDocumentFile(
    @Param('documentId') documentId: string,
    @Res() res: Response,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const storedFile =
        await this.storedFileQueryService.findByDocumentId(documentId);
      const document =
        await this.courseDocumentQueryService.findCourseDocumentById(
          documentId,
          userToken.sub,
        );

      let fileToSend: Buffer;

      if (storedFile.currentFileFormat === googlePresentationFileFormat) {
        fileToSend = await this.googleDriveService.exportFileAsPDF(
          storedFile.originalFileId,
        );
      } else if (storedFile.currentFileFormat === pdfMimeType) {
        fileToSend = await this.googleDriveService.getFile(
          storedFile.originalFileId,
        );
      } else {
        // convert file to pdf
        switch (storedFile.currentFileFormat) {
          case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
            const fileToConvert = await this.googleDriveService.getFile(
              storedFile.originalFileId,
            );
            fileToSend = await this.fileConversionService.convertDocument({
              buffer: fileToConvert,
              extension: 'docx',
              convertTo: 'pdf',
            });
            break;
          }
          case 'text/plain': {
            const fileToConvert = await this.googleDriveService.getFile(
              storedFile.originalFileId,
            );
            fileToSend = await this.fileConversionService.convertDocument({
              buffer: fileToConvert,
              extension: 'txt',
              convertTo: 'Pdf',
            });
            break;
          }
          case 'application/vnd.ms-powerpoint': {
            const fileToConvert = await this.googleDriveService.getFile(
              storedFile.originalFileId,
            );
            fileToSend = await this.fileConversionService.convertSlide({
              buffer: fileToConvert,
              extension: 'ppt',
              convertTo: ExportFormat['Pdf'],
            });
            break;
          }
          case 'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
            const fileToConvert = await this.googleDriveService.getFile(
              storedFile.originalFileId,
            );
            fileToSend = await this.fileConversionService.convertSlide({
              buffer: fileToConvert,
              extension: 'pptx',
              convertTo: ExportFormat['Pdf'],
            });
            break;
          }
          default: {
            throw new HttpException(
              'File format not supported for viewing',
              HttpStatus.BAD_REQUEST,
            );
          }
        }
      }

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="file.pdf"',
      });
      res.send(fileToSend);

      // update file if the type is not a pdf
      if (storedFile.currentFileFormat !== pdfMimeType) {
        setTimeout(async () => {
          const newFileUploaded = await this.googleDriveService.uploadFile({
            file: fileToSend,
            mimetype: pdfMimeType,
            originalFileName: document.title,
            mimeTypeToSaveAs: pdfMimeType,
          });

          const storedFileContent =
            await this.storedFileQueryService.findByDocumentId(documentId);

          await this.updateStoredFileHandler.handle({
            id: storedFile.id,
            modifiedContent:
              (storedFileContent.modifiedContent as unknown as PDFContent[][]) ||
              [],
            currentFileFormat: pdfMimeType,
            originalFileId: newFileUploaded.fileId,
          });

          await this.googleDriveService.deleteFile(storedFile.originalFileId);
        }, 500);
      }

      return;
    } catch (error) {
      console.log(error);
      throw new HttpException(
        'Failed to get original file',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Get('/modified-content/:documentId')
  public async getModifiedContent(
    @Param('documentId') documentId: string,
    @Req() request: Request,
  ): Promise<ModifiedContentModel> {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const storedFile =
        await this.storedFileQueryService.findByDocumentId(documentId);

      if (
        storedFile.originalFileId &&
        storedFile.modifiedContent &&
        JSON.parse(storedFile.modifiedContent).length
      ) {
        const htmlContent = (
          JSON.parse(storedFile.modifiedContent) as PDFContent[][]
        ).map((content) => {
          const contentPerPage = generateHTMLFromContent([content]);
          return contentPerPage;
        });

        return {
          content: htmlContent,
          pageCount: htmlContent.length,
        };
      }

      let originalFile: Buffer;
      if (storedFile.currentFileFormat === googlePresentationFileFormat) {
        originalFile = await this.googleDriveService.exportFileAsPDF(
          storedFile.originalFileId,
        );
      } else {
        originalFile = await this.googleDriveService.getFile(
          storedFile.originalFileId,
        );
      }

      const [document, summary] = await Promise.all([
        this.courseDocumentQueryService.findCourseDocumentById(
          documentId,
          userToken.sub,
        ),
        this.documentSummaryQueryService.findByDocumentId(documentId),
      ]);
      const pages = await this.extractTextService.getChunksBasedOnFileMimeType({
        buffer: originalFile,
        mimetype:
          storedFile.currentFileFormat === googlePresentationFileFormat
            ? pdfMimeType
            : storedFile.currentFileFormat,
        originalName: document.title,
      });
      const rewordedPages = await Promise.all(
        pages.map(async (page) => {
          // open ai call to reword
          if (page.trim().length) {
            const res = await this.simplifyTextContent(page, summary.summary);
            return res;
          }
          return [{ text: 'Empty Page', type: 'paragraph' }] as PDFContent[];
        }),
      );

      await this.updateStoredFileHandler.handle({
        id: storedFile.id,
        modifiedContent: rewordedPages,
      });

      const htmlContent = rewordedPages.map((content) => {
        const contentPerPage = generateHTMLFromContent([content]);
        return contentPerPage;
      });

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

  @UseGuards(AuthGuard)
  @Get('/modified-document-file/:documentId')
  public async getModifiedDocumentFile(
    @Param('documentId') documentId: string,
    @Req() request: Request,
    @Res() res: Response,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const storedFile =
        await this.storedFileQueryService.findByDocumentId(documentId);

      if (storedFile.originalFileId && storedFile.modifiedContent) {
        const newPdf = await createSimplifiedPdf(
          JSON.parse(storedFile.modifiedContent),
        );
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="file.pdf"',
        });
        res.send(newPdf);

        return;
      }

      let originalFile: Buffer;
      if (storedFile.currentFileFormat === googlePresentationFileFormat) {
        originalFile = await this.googleDriveService.exportFileAsPDF(
          storedFile.originalFileId,
        );
      } else {
        originalFile = await this.googleDriveService.getFile(
          storedFile.originalFileId,
        );
      }

      const [document, summary] = await Promise.all([
        this.courseDocumentQueryService.findCourseDocumentById(
          documentId,
          userToken.sub,
        ),
        this.documentSummaryQueryService.findByDocumentId(documentId),
      ]);
      const pages = await this.extractTextService.getChunksBasedOnFileMimeType({
        buffer: originalFile,
        mimetype:
          storedFile.currentFileFormat === googlePresentationFileFormat
            ? pdfMimeType
            : storedFile.currentFileFormat,
        originalName: document.title,
      });
      const rewordedPages = await Promise.all(
        pages.map(async (page) => {
          // open ai call to reword
          if (page.trim().length) {
            const res = await this.simplifyTextContent(page, summary.summary);
            return res;
          }
          return [{ text: 'Empty Page', type: 'paragraph' }] as PDFContent[];
        }),
      );

      const [newPdf, _] = await Promise.all([
        createSimplifiedPdf(rewordedPages),
        this.updateStoredFileHandler.handle({
          id: storedFile.id,
          modifiedContent: rewordedPages,
        }),
      ]);

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
      const openaiClient = createOpenAI({
        compatibility: 'strict',
        apiKey: EnvironmentVariables.config.openAiApiKey,
      });

      const response = await generateObject({
        model: openaiClient.responses('gpt-4o-mini'),
        maxRetries: 3,
        mode: 'json',
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
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async simplifyTextContent(content: string, summary: string) {
    try {
      const openaiClient = createOpenAI({
        compatibility: 'strict',
        apiKey: EnvironmentVariables.config.openAiApiKey,
      });

      const response = await generateObject({
        model: openaiClient.responses('gpt-4o-mini'),
        maxRetries: 3,
        mode: 'json',
        schemaName: 'simplified',
        schema: SimplifiedPDFArraySchema,
        messages: [
          { role: 'system', content: getTextSimplificationPrompt(summary) },
          {
            role: 'user',
            content: `
            **source text start**
            ${content}
            **source text end**
            `,
          },
        ],
      });

      return response.object.simplifiedContent as PDFContent[];
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Failed to simplify content',
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }
}
