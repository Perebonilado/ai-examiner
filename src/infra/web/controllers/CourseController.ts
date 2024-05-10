import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { CreateCourseHandler } from 'src/business/handlers/Course/CreateCourseHandler';
import { CreateCourseDto } from 'src/dto/CreateCourseDto';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { CourseQueryService } from 'src/query/services/CourseQueryService';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateCourseDocumentHandler } from 'src/business/handlers/CourseDocument/CreateCourseDocumentHandler';
import { CreateQuestionHandler } from 'src/business/handlers/Question/CreateQuestionHandler';
import { CreateCourseDocumentQuestionDto } from 'src/dto/CreateCourseDocumentQuestionDto';
import { ExaminerService } from 'src/integrations/open-ai/services/ExaminerService';
import { initialGenerationPrompt } from 'src/constants';
import { extractQuestionsFromMessages } from 'src/utils';

@Controller('course')
export class CourseController {
  constructor(
    @Inject(CourseQueryService) private courseQueryService: CourseQueryService,
    @Inject(CreateCourseHandler)
    private createCourseHandler: CreateCourseHandler,
    @Inject(CreateCourseDocumentHandler)
    private createCourseDocumentHandler: CreateCourseDocumentHandler,
    @Inject(CreateQuestionHandler)
    private createQuestionHandler: CreateQuestionHandler,
    @Inject(ExaminerService) private examinerService: ExaminerService,
  ) {}

  @UseGuards(AuthGuard)
  @Get('')
  public async getAllCourses(@Req() request: Request) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      return await this.courseQueryService.findAllUserCourses(userToken.sub);
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to find user courses',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('')
  public async createCourse(
    @Req() request: Request,
    @Body() body: Omit<CreateCourseDto, 'userId'>,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      return await this.createCourseHandler.handle({
        payload: { ...body, userId: userToken.sub },
      });
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to create course',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('/generate-doc-question')
  @UseInterceptors(FileInterceptor('document'))
  public async createCourseDocAndQuestion(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateCourseDocumentQuestionDto,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;

      const createdCourse = await this.createCourseHandler.handle({
        payload: {
          description: body.courseDescription,
          title: body.courseTitle,
          userId: userToken.sub,
        },
      });

      const uploadedFile = await this.examinerService.uploadFile(file);
      const vectorStore = await this.examinerService.createVectorStore(
        file.originalname,
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

      const createdDocument = await this.createCourseDocumentHandler.handle({
        payload: {
          courseId: createdCourse.data.id,
          title: body.documentTitle,
          userId: userToken.sub,
          fileId: uploadedFile.id,
          threadId: updatedThread.id,
        },
      });

      await this.examinerService.createThreadMessage(
        updatedThread.id,
        initialGenerationPrompt,
      );

      //find assistant and get id to pass in
      await this.examinerService.createRun('', updatedThread.id);

      const messages = await this.examinerService.retrieveThreadMessages(
        updatedThread.id,
      );

      const mostRecentlyGeneratedQuestions = extractQuestionsFromMessages(messages)

      await this.createQuestionHandler.handle({
        payload: {
          courseDocumentId: createdDocument.data.id,
          data: mostRecentlyGeneratedQuestions,
          userId: userToken.sub,
        },
      });

      return {
        data: null,
        status: HttpStatus.CREATED,
        message: 'Course created, document uploaded and questions generated',
      };
    } catch (error) {
      console.log(error);
      throw new HttpException(
        error?.response ??
          'Failed to create course, document and generate questions',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
