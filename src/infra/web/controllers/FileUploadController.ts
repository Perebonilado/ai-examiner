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
import {
  extractJSONDataFromMessages,
  generateUUID,
  splitPdfPagesToIndividualFiles,
  trimToEstimatedTokens,
} from 'src/utils';
import { generateMessagePrompt } from 'src/constants';
import { CreateDocumentTopicHandler } from 'src/business/handlers/DocumentTopic/CreateDocumentTopicHandler';
import {
  generateGenericTopicsPrompt,
  generateTopicCategorizationPrompt,
  generateTopicPromptV2,
  generateTopicPromptV2_2,
  generateTopicPromptV2_3,
} from 'src/constants/QuestionGenerationPromptV2';
import {
  generateDocumentSummaryPromptV2,
  summarizeDocumentPrompt,
} from 'src/constants/V2Prompts';
import { createOpenAI, OpenAIProvider } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { TopicsSchema } from 'src/schemas/TopicsSchema';
import { UpdateCourseDocumentHandler } from 'src/business/handlers/CourseDocument/UpdateCourseDocumentHandler';
import { CreateDocumentSummaryHandler } from 'src/business/handlers/DocumentSummary/CreateDocumentSummaryHandler';
import { GoogleDriveService } from 'src/integrations/google/services/GoogleDriveService';
import { CreateStoredFileHandler } from 'src/business/handlers/StoredFile/CreateStoredFileHandler';
import { ILovePdfService } from 'src/integrations/i-love-pdf/services/ILovePdfService';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { TopicsSchemaV2 } from 'src/schemas/TopicsSchemaV2';
import { TopicV2Model } from '../models/TopicV2Model';

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
        const summaryInfo = await this.summarizeDocumentV2(chunks.join('\n'));
        await this.createDocumentSummaryHandler.handle({
          documentId: createdDocument.data.id,
          summary: summaryInfo,
          userId: userToken.sub,
        });

        return summaryInfo;
      };

      const createdDocument = await this.createCourseDocumentHandler.handle({
        payload: {
          title: file.originalname,
          userId: userToken.sub,
          courseId: '',
          fileId: '',
        },
      });
      const summaryCreationPromise = createDocSummary();
      const uploadGoogleDrivePromise = uploadFileToGoogleAndSaveStoredFile();

      const topics = await this.generateDocumentTopicV3(
        chunks,
        createdDocument.data.id,
        userToken.sub,
      );

      if (chunks.length < this.extractTextService.MAX_CHUNKS) {
        await Promise.all([
          this.pineconeChunkService.upsertChunks(
            chunks.filter((c) => c.trim().length),
            createdDocument.data.id,
          ),
          this.createDocumentTopicHandler.handle({ payload: topics }),
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
          this.createDocumentTopicHandler.handle({ payload: topics }),
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

  private async summarizeDocumentV2(sourceText: string) {
    try {
      const google = createGoogleGenerativeAI({
        apiKey: EnvironmentVariables.config.geminiApiKey,
      });
      const { text: summary } = await generateText({
        model: google('gemini-1.5-flash'),
        prompt: generateDocumentSummaryPromptV2(sourceText),
      });
      // const openai = createOpenAI({
      //   compatibility: 'strict',
      //   apiKey: EnvironmentVariables.config.openAiApiKey,
      // });

      // const { text: summary } = await generateText({
      //   model: openai.responses('gpt-4o-mini'),
      //   maxRetries: 3,
      //   prompt: generateDocumentSummaryPromptV2(sourceText),
      // });

      return summary;
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Failed to summarize doc',
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }

  private batchItems<T>(documentPages: T[]) {
    const splitChunks: T[][] = [];
    const maxChunks = 5;
    for (let i = 0; i < documentPages.length; i += maxChunks) {
      splitChunks.push(documentPages.slice(i, i + maxChunks));
    }
    return splitChunks;
  }

  private async generateDocumentTopicV3(
    documentByPages: string[],
    documentId: string,
    userId: string,
  ): Promise<TopicV2Model[]> {
    try {
      /**
       * generate generic topics
       * batch pages
       * tag each page within each batch with predefined topics
       */

      const google = createGoogleGenerativeAI({
        apiKey: EnvironmentVariables.config.geminiApiKey,
      });

      const genericTopicsResponse = await generateObject({
        model: google('gemini-1.5-flash'),
        maxRetries: 3,
        mode: 'json',
        schemaName: 'Topics',
        schema: TopicsSchema,
        prompt: generateGenericTopicsPrompt(documentByPages.join('\n')),
      });

      const genericTopics = genericTopicsResponse.object.topics!;
      const totalPages = documentByPages.length;
      const batchedPages = this.batchItems<string>(documentByPages);
      const taggedPages = await Promise.all(
        batchedPages.map(async (batch) => {
          const tagged: string[] = [];
          let currentIndex = 0;

          for (const pageItem of batch) {
            const previousPage =
              currentIndex === 0
                ? 'Unavailable as page is the first page'
                : batch[currentIndex - 1];
            const lastPageIndex = totalPages - 1;
            const nextPage =
              currentIndex === lastPageIndex
                ? 'Unavailable as page is the last page'
                : batch[currentIndex + 1];
            if (pageItem.trim().length) {
              const response = await generateText({
                model: google('gemini-1.5-flash'),
                maxRetries: 3,
                prompt: generateTopicCategorizationPrompt({
                  genericTopics: genericTopics.map((t) =>
                    t.topic.toLowerCase(),
                  ),
                  nextPageText: nextPage,
                  pageNumber: currentIndex + 1,
                  pageText: pageItem,
                  previousPageText: previousPage,
                  totalPages,
                }),
              });
              tagged.push(response.text);
            } else {
              tagged.push('empty page');
            }

            currentIndex++;
          }
          return tagged;
        }),
      );

      const topicsWithStartAndEndPage: TopicV2Model[] = [];
      const flattenedTopicsArr = taggedPages.flat();
      flattenedTopicsArr.forEach((topic, index) => {
        const isFirstPage = index === 0;
        const shortDescription =
          genericTopics.find(
            (gt) =>
              gt.topic.toLowerCase().trim() === topic.toLowerCase().trim(),
          )?.shortDescription || null;
        const topicModel: TopicV2Model = {
          startPage: index + 1,
          endPage: index + 1,
          title: topic.toLowerCase().trim(),
          shortDescription,
          documentId,
          userId,
        };

        if (isFirstPage) {
          topicsWithStartAndEndPage.push(topicModel);
        } else {
          const isPreviousPageSameTopic =
            flattenedTopicsArr[index - 1].toLowerCase() === topic.toLowerCase();

          if (isPreviousPageSameTopic) {
            topicsWithStartAndEndPage[topicsWithStartAndEndPage.length - 1]
              .endPage++;
          } else {
            topicsWithStartAndEndPage.push(topicModel);
          }
        }
      });

      console.log(topicsWithStartAndEndPage)

      return topicsWithStartAndEndPage;
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Failed to generate topics',
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async generateDocumentTopicsV2(sourceText: string) {
    try {
      // const google = createGoogleGenerativeAI({
      //   apiKey: EnvironmentVariables.config.geminiApiKey,
      // });
      // const response = await generateObject({
      //   model: google('gemini-1.5-flash'),
      //   maxRetries: 3,
      //   mode: 'json',
      //   schemaName: 'Topics',
      //   schema: TopicsSchema,
      //   prompt: generateTopicPromptV2_2(sourceText),
      // });

      const openai = createOpenAI({
        compatibility: 'strict',
        apiKey: EnvironmentVariables.config.openAiApiKey,
      });

      const response = await generateObject({
        model: openai.responses('gpt-4o-mini'),
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
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }
}
