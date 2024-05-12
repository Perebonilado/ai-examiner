import {
  Controller,
  Inject,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { CreateCourseDocumentHandler } from 'src/business/handlers/CourseDocument/CreateCourseDocumentHandler';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { Request } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { CreateCourseDocumentDto } from 'src/dto/CreateCourseDocumentDto';
import { CourseDocumentQueryService } from 'src/query/services/CourseDocumentQueryService';
import { GetAllCourseDocumentDto } from 'src/dto/GetAllCourseDocumentDto';
import { GenerateCourseDocumentQuestionDto } from 'src/dto/GenerateCourseDocumentQuestionsDto';
import { CreateQuestionHandler } from 'src/business/handlers/Question/CreateQuestionHandler';
import { ExaminerService } from 'src/integrations/open-ai/services/ExaminerService';
import { extractQuestionsFromMessages } from 'src/utils';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { initialGenerationPrompt } from 'src/constants';

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
  ) {}

  @UseGuards(AuthGuard)
  @Get('')
  public async getAllCourseDocuments(
    @Req() request: Request,
    @Query('courseId') courseId: string,
    @Query('title') title: string,
    @Query('page', ParseIntPipe) page: number,
    @Query('pageSize', ParseIntPipe) pageSize: number,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      return await this.courseDocumentQueryService.findAllUserCoursesDocumentsByCourseId(
        courseId ?? '',
        title ?? '',
        userToken.sub,
        pageSize,
        page
      );
    } catch (error) {
      console.log(error)
      throw new HttpException(
        error?.response ?? 'Failed to find course documents',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('/:id/generate-questions')
  public async generateDocumentQuestions(
    @Param() params: GenerateCourseDocumentQuestionDto,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const document =
        await this.courseDocumentQueryService.findCourseDocumentById(
          params.id,
          userToken.sub,
        );

      if (document) {
        const existingThread = await this.examinerService.findThread(
          document.openAiThreadId,
        );

        // check if vector store has expired, if so:
        // create new store, attach file and attach to thread
        if (
          !existingThread.tool_resources.file_search.vector_store_ids.length
        ) {
          const newVectorStore = await this.examinerService.createVectorStore(
            document.title,
          );
          const updatedVectorStore =
            await this.examinerService.attachFileToVectorStore(
              document.openAiFileId,
              newVectorStore.id,
            );

          await this.examinerService.attachVectorStoreToThread(
            existingThread.id,
            updatedVectorStore.id,
          );
        }

        await this.examinerService.createThreadMessage(
          existingThread.id,
          initialGenerationPrompt,
        );

        await this.examinerService.createRun(
          EnvironmentVariables.config.assistantId,
          existingThread.id,
        );

        const messages = await this.examinerService.retrieveThreadMessages(
          existingThread.id,
        );

        const mostRecentlyGeneratedQuestions =
          extractQuestionsFromMessages(messages);

        return await this.createQuestionHandler.handle({
          payload: {
            courseDocumentId: document.id,
            data: mostRecentlyGeneratedQuestions,
            userId: userToken.sub,
          },
        });
      } else {
        throw new HttpException(
          'Course Document does not exist',
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
  @Post('')
  @UseInterceptors(FileInterceptor('document'))
  public async createCourseDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Omit<CreateCourseDocumentDto, 'userId'>,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;

      const uploadedFile = await this.examinerService.uploadFile(file);

      const vectorStore = await this.examinerService.createVectorStore(
        body.title,
      );

      const updatedVectorStore =
        await this.examinerService.attachFileToVectorStore(
          uploadedFile.id,
          vectorStore.id,
        );

      const thread = await this.examinerService.createThread();

      const updatedThread =
        await this.examinerService.attachVectorStoreToThread(
          thread.id,
          updatedVectorStore.id,
        );

      return await this.createCourseDocumentHander.handle({
        payload: {
          courseId: body.courseId,
          title: body.title,
          userId: userToken.sub,
          fileId: uploadedFile.id,
          threadId: updatedThread.id,
        },
      });
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to create course document',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
