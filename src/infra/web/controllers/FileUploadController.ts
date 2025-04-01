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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { CreateCourseDocumentHandler } from 'src/business/handlers/CourseDocument/CreateCourseDocumentHandler';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { ExaminerService } from 'src/integrations/open-ai/services/ExaminerService';
import { PineconeChunkService } from 'src/integrations/pinecone/services/PineconeChunksService';
import { ExtractTextService } from 'src/integrations/text-extraction/services/ExtractTextService';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { QuestionQueryService } from 'src/query/services/QuestionQueryService';
import { CreateQuestionHandler } from 'src/business/handlers/Question/CreateQuestionHandler';
import { extractJSONDataFromMessages, generateUUID } from 'src/utils';
import { generateTopicPrompt } from 'src/constants';
import { CreateDocumentTopicHandler } from 'src/business/handlers/DocumentTopic/CreateDocumentTopicHandler';
import { generateTopicPromptV2 } from 'src/constants/QuestionGenerationPromptV2';
import { PreferredLanguageQueryService } from 'src/query/services/PreferredLanguageQueryService';

@Controller('file-upload')
export class FileUploadController {
  constructor(
    @Inject(ExtractTextService) private extractTextService: ExtractTextService,
    @Inject(ExaminerService) private examinerService: ExaminerService,
    @Inject(CreateCourseDocumentHandler)
    private createCourseDocumentHandler: CreateCourseDocumentHandler,
    @Inject(PineconeChunkService)
    private pineconeChunkService: PineconeChunkService,
    @Inject(QuestionQueryService)
    private questionQueryService: QuestionQueryService,
    @Inject(CreateQuestionHandler)
    private createQuestionHandler: CreateQuestionHandler,
    @Inject(CreateDocumentTopicHandler)
    private createDocumentTopicHandler: CreateDocumentTopicHandler,
    @Inject(PreferredLanguageQueryService)
    private preferredLanguageQueryService: PreferredLanguageQueryService,
  ) {}

  @UseGuards(AuthGuard)
  @Post('')
  @UseInterceptors(FileInterceptor('document'))
  public async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('pages') pages: string,
    @Query('start') start: string,
    @Query('end') end: string,
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
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const pdfPageRange =
        pages === 'custom' ? { start: Number(start), end: Number(end) } : {};

      const uploadedOpenAiFile = await this.examinerService.uploadFile(
        file,
        pdfPageRange,
      );

      const preferredLanguage = await this.preferredLanguageQueryService.findByUserId(userToken.sub)

      const [chunks, createdDocument, topics] = await Promise.all([
        this.extractTextService.getChunksBasedOnFileMimeType(file),
        this.createCourseDocumentHandler.handle({
          payload: {
            title: file.originalname,
            userId: userToken.sub,
            courseId: '',
            fileId: uploadedOpenAiFile.id,
          },
        }),
        this.generateDocumentTopic(uploadedOpenAiFile.id, preferredLanguage ? preferredLanguage.language : 'English'),
      ]);

      if (chunks.length < this.extractTextService.MAX_CHUNKS) {
        const mappedTopics = topics.map((topic) => {
          return {
            title: topic,
            documentId: createdDocument.data.id,
            userId: userToken.sub,
          };
        });

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
        const mappedTopics = topics.map((topic) => {
          return {
            title: topic,
            documentId: createdDocument.data.id,
            userId: userToken.sub,
          };
        });

        await Promise.all([
          upsertPromises,
          this.createDocumentTopicHandler.handle({ payload: mappedTopics }),
        ]);
      }

      return {
        data: {
          documentId: createdDocument.data.id,
          fileId: uploadedOpenAiFile.id,
          topics,
        },
        message: 'File uploaded successfully',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HttpException(
        error ?? 'V2: Failed to upload file',
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
