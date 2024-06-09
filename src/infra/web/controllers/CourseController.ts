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
  Query,
  ParseIntPipe,
  Param,
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
import {
  defaultPageNumber,
  defaultPageSize,
  generateQuestionsPrompt,
} from 'src/constants';
import { extractJSONDataFromMessages } from 'src/utils';
import { EnvironmentVariables } from 'src/EnvironmentVariables';

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
  public async getAllCourses(
    @Req() request: Request,
    @Query('title') title: string,
    @Query('page', ParseIntPipe) page: number,
    @Query('pageSize', ParseIntPipe) pageSize: number,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const data = await this.courseQueryService.findAllUserCourses(
        title ?? '',
        userToken.sub,
        pageSize ?? defaultPageSize,
        page ?? defaultPageNumber,
      );

      return {
        data,
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to find user courses',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Get('/:id')
  public async getCourseById(@Req() request: Request, @Param('id') id: string) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const course = await this.courseQueryService.findCourseById(
        userToken.sub,
        id,
      );

      if (course) {
        return {
          data: course,
          status: HttpStatus.OK,
        };
      } else {
        throw new HttpException('Course not found', HttpStatus.NOT_FOUND);
      }
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to find user course by id',
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
    @Query('questionCount') questionCount: number,
    @Query('questionType') questionType: number,
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
      const updatedVectorStoreId =
        await this.examinerService.attachFileToVectorStore(
          uploadedFile.id,
          vectorStore.id,
        );
      const thread = await this.examinerService.createThread();
      const updatedThread =
        await this.examinerService.attachVectorStoreToThread(
          thread.id,
          updatedVectorStoreId,
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
        generateQuestionsPrompt(questionCount || 5),
      );

      const run = await this.examinerService.createRun(
        EnvironmentVariables.config.assistantId,
        updatedThread.id,
      );

      const messages = await this.examinerService.retrieveThreadMessages(
        updatedThread.id,
        run.id
      );

      const mostRecentlyGeneratedQuestions =
        extractJSONDataFromMessages(messages);

      await this.createQuestionHandler.handle({
        payload: {
          courseDocumentId: createdDocument.data.id,
          data: mostRecentlyGeneratedQuestions,
          userId: userToken.sub,
          questionTypeId: questionType
        },
      });

      return {
        data: null,
        status: HttpStatus.CREATED,
        message: 'Course created, document uploaded and questions generated',
      };
    } catch (error) {
      throw new HttpException(
        error?.response ??
          'Failed to create course, document and generate questions',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
