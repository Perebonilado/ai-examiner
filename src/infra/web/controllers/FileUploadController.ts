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
import { batchItems, splitPdfPagesToIndividualFiles } from 'src/utils';
import { CreateDocumentTopicHandler } from 'src/business/handlers/DocumentTopic/CreateDocumentTopicHandler';
import {
  generateGenericTopicsPrompt,
  generateTopicCategorizationPrompt,
} from 'src/constants/QuestionGenerationPromptV2';
import { generateDocumentSummaryPromptV2 } from 'src/constants/V2Prompts';
import { TopicsSchema } from 'src/schemas/TopicsSchema';
import { UpdateCourseDocumentHandler } from 'src/business/handlers/CourseDocument/UpdateCourseDocumentHandler';
import { CreateDocumentSummaryHandler } from 'src/business/handlers/DocumentSummary/CreateDocumentSummaryHandler';
import { GoogleDriveService } from 'src/integrations/google/services/GoogleDriveService';
import { CreateStoredFileHandler } from 'src/business/handlers/StoredFile/CreateStoredFileHandler';
import { ILovePdfService } from 'src/integrations/i-love-pdf/services/ILovePdfService';
import { TopicV2Model } from '../models/TopicV2Model';
import { GEMINI_CONN } from 'src/integrations/vercel-ai/services/GeminiConn';
import { OPENAI_CONN } from 'src/integrations/vercel-ai/services/OpenAIConn';
import { AI } from 'src/integrations/vercel-ai/services/AI';

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
    @Inject(GEMINI_CONN) private readonly geminiConn: AI,
    @Inject(OPENAI_CONN) private readonly openAIConn: AI,
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

      const savedTopics = await this.createDocumentTopicHandler.handle({
        payload: topics.map((t) => {
          return {
            documentId: createdDocument.data.id,
            title: t.title,
            endPage: t.endPage,
            startPage: t.startPage,
            shortDescription: t.shortDescription,
            userId: userToken.sub,
          };
        }),
      });

      // return a response here
      res.status(HttpStatus.CREATED).json({
        data: {
          documentId: createdDocument.data.id,
          fileId: 'not yet set',
          topics: Array.from(
            new Set(savedTopics.data.data.map((t) => t.title)),
          ),
          topicsWithPages: savedTopics.data.data,
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
      const summary = await this.geminiConn.generateText({
        prompt: generateDocumentSummaryPromptV2(sourceText),
      });

      return summary;
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Failed to summarize doc',
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
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

      const genericTopicsResponse = await this.geminiConn.generateObject({
        prompt: generateGenericTopicsPrompt(documentByPages.join('\n')),
        schemaName: 'Topics',
        schema: TopicsSchema,
        schemaDescription: 'Topics for study material',
      });

      const genericTopics = genericTopicsResponse.object.topics!;
      const totalPages = documentByPages.length;
      const batchedPages = batchItems<string>(documentByPages);
      let currentIndex = 0;
      const taggedPages = await Promise.all(
        batchedPages.map(async (batch) => {
          const tagged: string[] = [];

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
              const text = await this.openAIConn.generateText({
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

              tagged.push(text);
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

        if (!topicsWithStartAndEndPage.length) {
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

      return topicsWithStartAndEndPage;
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Failed to generate topics',
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }
}
