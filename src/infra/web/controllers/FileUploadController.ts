import {
  Controller,
  Post,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Inject,
  HttpException,
  HttpStatus,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { CreateCourseDocumentHandler } from 'src/business/handlers/CourseDocument/CreateCourseDocumentHandler';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { ExaminerService } from 'src/integrations/open-ai/services/ExaminerService';
import { PineconeChunkService } from 'src/integrations/pinecone/services/PineconeChunksService';
import { ExtractTextService } from 'src/integrations/text-extraction/services/ExtractTextService';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { QuestionQueryService } from 'src/query/services/QuestionQueryService';
import { CreateQuestionHandler } from 'src/business/handlers/Question/CreateQuestionHandler';
import {
  extractJSONDataFromMessages,
  generateUUID,
  splitPdfPagesToIndividualFiles,
  writeFileToStream,
} from 'src/utils';
import { generateMessagePrompt, generateTopicPrompt } from 'src/constants';
import { CreateDocumentTopicHandler } from 'src/business/handlers/DocumentTopic/CreateDocumentTopicHandler';
import {
  generateTopicPromptV2,
  generateTopicPromptV2_2,
} from 'src/constants/QuestionGenerationPromptV2';
import { PreferredLanguageQueryService } from 'src/query/services/PreferredLanguageQueryService';
import {
  generateDocumentSummaryPromptV2,
  summarizeDocumentPrompt,
} from 'src/constants/V2Prompts';
import { CreateDocumentMessageHandler } from 'src/business/handlers/DocumentMessage/CreateDocumentMessageHandler';
import { createOpenAI, openai, OpenAIProvider } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { TopicsSchema } from 'src/schemas/TopicsSchema';
import { UpdateCourseDocumentHandler } from 'src/business/handlers/CourseDocument/UpdateCourseDocumentHandler';
import { CreateDocumentSummaryHandler } from 'src/business/handlers/DocumentSummary/CreateDocumentSummaryHandler';
import { createReadStream, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlink } from 'fs/promises';
import OpenAI from 'openai';
import { GoogleDriveService } from 'src/integrations/google/services/GoogleDriveService';
import { MistralOcrService } from 'src/integrations/mistral-ai/services/MistralOcrService';
import { CreateStoredFileHandler } from 'src/business/handlers/StoredFile/CreateStoredFileHandler';
import { ILovePdfService } from 'src/integrations/i-love-pdf/services/ILovePdfService';

@Controller('file-upload')
export class FileUploadController {
  constructor(
    @Inject(ExtractTextService) private extractTextService: ExtractTextService,
    @Inject(ExaminerService) private examinerService: ExaminerService,
    @Inject(CreateCourseDocumentHandler)
    private createCourseDocumentHandler: CreateCourseDocumentHandler,
    @Inject(PineconeChunkService)
    private pineconeChunkService: PineconeChunkService,
    @Inject(CreateDocumentTopicHandler)
    private createDocumentTopicHandler: CreateDocumentTopicHandler,
    @Inject(UpdateCourseDocumentHandler)
    private updateCourseDocumentHandler: UpdateCourseDocumentHandler,
    @Inject(CreateDocumentSummaryHandler)
    private createDocumentSummaryHandler: CreateDocumentSummaryHandler,
    @Inject(GoogleDriveService) private googleDriveService: GoogleDriveService,
    @Inject(CreateStoredFileHandler)
    private createStoredFileHandler: CreateStoredFileHandler,
    @Inject(ILovePdfService) private iLovePDFService: ILovePdfService,
  ) {}

  @UseGuards(AuthGuard)
  @Post('')
  @UseInterceptors(FileInterceptor('document'))
  public async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('pages') pages: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Res() res: Response,
  ) {
    try {
      const pdfPageRange =
        pages === 'custom' ? { start: Number(start), end: Number(end) } : {};
      const uploadedFile = await this.examinerService.uploadFile(
        file,
        pdfPageRange,
      );

      return {
        data: {
          fileId: uploadedFile.id,
        },
        message: 'File uploaded successfully',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HttpException(
        error || 'Failed to upload file',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('/v2')
  @UseInterceptors(FileInterceptor('document'))
  public async uploadFileV2(
    @UploadedFile() file: Express.Multer.File,
    @Query('pages') pages: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Req() request: Request,
    @Res() res: Response,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const pdfPageRange =
        pages === 'custom' ? { start: Number(start), end: Number(end) } : {};

      const openaiClient = createOpenAI({
        compatibility: 'strict',
        apiKey: EnvironmentVariables.config.openAiApiKey,
      });

      const maxNumPagesForSummaryAndTopicGeneration = 250;

      let fileFormatToSaveFile = 'application/vnd.google-apps.presentation';
      const googleFileExportLimitInMegaBytes = 10 * 1024 * 1024;

      if (file.mimetype === 'application/pdf') {
        fileFormatToSaveFile = 'application/pdf';
      } else if (file.size > googleFileExportLimitInMegaBytes) {
        fileFormatToSaveFile = file.mimetype;
      }

      let fileBufferToUse = file.buffer;
      let isPPTFormat = file.mimetype === 'application/vnd.ms-powerpoint';

      if (isPPTFormat) {
        fileBufferToUse = await this.iLovePDFService.processFileBasedOnTool(
          {
            buffer: file.buffer,
            mimetype: file.mimetype,
            originalname: file.originalname,
          },
          'officepdf',
        );

        fileFormatToSaveFile = 'application/pdf';
      }

      const chunks = await this.extractTextService.getChunksBasedOnFileMimeType(
        {
          buffer: fileBufferToUse,
          mimetype: isPPTFormat ? 'application/pdf' : file.mimetype,
          originalName: file.originalname,
        },
      );

      const uploadFileToGoogleAndSaveStoredFile = async () => {
        const uploadedGoogleDriveFile =
          await this.googleDriveService.uploadFile({
            file: fileBufferToUse,
            originalFileName: file.originalname,
            mimetype: file.mimetype,
            mimeTypeToSaveAs: fileFormatToSaveFile,
          });
        await this.createStoredFileHandler.handle({
          documentId: createdDocument.data.id,
          originalFileId: uploadedGoogleDriveFile.fileId,
          currentFileFormat: fileFormatToSaveFile,
        });
      };

      const createDocSummary = async () => {
        const summaryInfo = await this.summarizeDocumentV2(
          openaiClient,
          chunks.slice(0, maxNumPagesForSummaryAndTopicGeneration).join('\n'),
        );
        await this.createDocumentSummaryHandler.handle({
          documentId: createdDocument.data.id,
          summary: summaryInfo,
          userId: userToken.sub,
        });

        return summaryInfo;
      };

      const uploadGoogleDrivePromise = uploadFileToGoogleAndSaveStoredFile();
      const summaryCreationPromise = createDocSummary();

      const [createdDocument, topics] = await Promise.all([
        this.createCourseDocumentHandler.handle({
          payload: {
            title: file.originalname,
            userId: userToken.sub,
            courseId: '',
            fileId: '',
          },
        }),
        this.generateDocumentTopicsV2(
          openaiClient,
          chunks.slice(0, maxNumPagesForSummaryAndTopicGeneration).join('\n'),
        ),
      ]);

      const mappedTopics = topics.map((topic) => {
        return {
          title: topic,
          documentId: createdDocument.data.id,
          userId: userToken.sub,
        };
      });

      if (chunks.length < this.extractTextService.MAX_CHUNKS) {
        await Promise.all([
          this.pineconeChunkService.upsertChunks(
            chunks.filter((c) => c.trim().length),
            createdDocument.data.id,
          ),
          this.createDocumentTopicHandler.handle({ payload: mappedTopics }),
        ]);
      } else {
        const splitChunks: string[][] = [];
        const maxChunks = this.extractTextService.MAX_CHUNKS;

        for (let i = 0; i < chunks.length; i += maxChunks) {
          splitChunks.push(
            chunks.slice(i, i + maxChunks).filter((chunk) => {
              // remove empty chunks
              if (!chunk.trim().length) {
                return false;
              }

              return true;
            }),
          );
        }

        let startIndex = 0;

        const upsertPromises = splitChunks.map((chunk) => {
          const currentStartIndex = startIndex; // Store the current start index
          startIndex += chunk.length; // Update start index for the next iteration

          return this.pineconeChunkService.upsertChunks(
            chunk,
            createdDocument.data.id,
            currentStartIndex,
          );
        });

        await Promise.all([
          upsertPromises,
          this.createDocumentTopicHandler.handle({ payload: mappedTopics }),
        ]);
      }

      const [summaryInfo] = await Promise.all([
        summaryCreationPromise,
        uploadGoogleDrivePromise,
      ]);

      // return a response here
      res.status(HttpStatus.CREATED).json({
        data: {
          documentId: createdDocument.data.id,
          fileId: 'not yet set',
          topics,
          summary: summaryInfo,
        },
        message: 'File uploaded successfully',
        status: HttpStatus.CREATED,
      });

      setImmediate(async () => {
        const uploadedOpenAiFile = await this.examinerService.uploadFile(
          file,
          pdfPageRange,
        );

        await Promise.all([
          this.updateCourseDocumentHandler.handle({
            data: {
              openAiFileId: uploadedOpenAiFile.id,
              id: createdDocument.data.id,
            },
            userId: userToken.sub,
          }),
        ]);
      });
    } catch (error) {
      console.log(error);
      throw new HttpException(
        error ?? 'V2: Failed to upload file',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('/extract-written-text')
  @UseInterceptors(FileInterceptor('document'))
  public async extractWrittenText(
    @UploadedFile() file: Express.Multer.File,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    try {
      let splitPages = await splitPdfPagesToIndividualFiles(file.buffer);
      if (start?.trim()?.length && end?.trim()?.length) {
        splitPages = splitPages.slice(Number(start) - 1, Number(end));
      }
      const extractedTexts = await Promise.all(
        splitPages.map(async (page) => {
          const text = await this.examinerService.handWrittenPDFOCR(page);
          return text;
        }),
      );

      return extractedTexts;
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Failed to extract written text',
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async summarizeDocumentV2(
    client: OpenAIProvider,
    sourceText: string,
  ) {
    try {
      const { text: summary } = await generateText({
        model: client('gpt-4o-mini'),
        prompt: generateDocumentSummaryPromptV2(sourceText),
      });

      return summary;
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Failed to summarize doc',
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async generateDocumentTopicsV2(
    client: OpenAIProvider,
    sourceText: string,
  ) {
    try {
      const response = await generateObject({
        model: client.responses('gpt-4o-mini'),
        maxRetries: 3,
        mode: 'json',
        schemaName: 'Topics',
        schema: TopicsSchema,
        prompt: generateTopicPromptV2_2(sourceText),
      });

      return response.object.topics as string[];
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Failed to generate topics',
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async summarizeDocument(fileId: string) {
    try {
      const assistantId =
        EnvironmentVariables.config.documentSummarizationAssistantId;

      const temporaryVectorStoreName = `${generateUUID()}_${new Date().getTime()}`;

      const temporaryVectorStore = await this.examinerService.createVectorStore(
        temporaryVectorStoreName,
      );

      const updatedVectorStoreId =
        await this.examinerService.attachFileToVectorStore(
          fileId,
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
        generateMessagePrompt({
          message: summarizeDocumentPrompt,
          language: 'English',
          prefix: '',
          responseFormat: 'summary',
        }),
      );

      const run = await this.examinerService.createRun(
        assistantId,
        updatedThread.id,
      );

      const messages = await this.examinerService.retrieveThreadMessages(
        updatedThread.id,
        run.id,
      );

      const text = (messages.data[0].content[0] as any).text.value;

      return { summary: text, threadId: updatedThread.id };
    } catch (error) {
      throw new HttpException(
        'Failed to summarize doc',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async generateDocumentTopic(
    fileId: string,
    preferredLanguage: string,
  ) {
    try {
      const assistantId =
        EnvironmentVariables.config.topicExtractionAssistantId;

      const temporaryVectorStoreName = `${generateUUID()}_${new Date().getTime()}`;

      const temporaryVectorStore = await this.examinerService.createVectorStore(
        temporaryVectorStoreName,
      );

      const updatedVectorStoreId =
        await this.examinerService.attachFileToVectorStore(
          fileId,
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
        generateTopicPromptV2(preferredLanguage),
      );

      const run = await this.examinerService.createRun(
        assistantId,
        updatedThread.id,
      );

      const messages = await this.examinerService.retrieveThreadMessages(
        updatedThread.id,
        run.id,
      );

      const generatedTopics = extractJSONDataFromMessages(messages) as string[];

      return generatedTopics;
    } catch (error) {
      throw new HttpException(
        'Failed to get topics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
