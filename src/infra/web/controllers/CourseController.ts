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
import { AIExaminerService } from 'src/integrations/open-ai/services/AIExaminerService';
import { UserQueryService } from 'src/query/services/UserQueryService';

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
    @Inject(AIExaminerService) private aiExaminerService: AIExaminerService,
    @Inject(UserQueryService) private userQueryService: UserQueryService,
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
        payload: { ...body.courseInfo, userId: userToken.sub },
      });

      const createdDocument = await this.createCourseDocumentHandler.handle({
        payload: {
          courseId: createdCourse.data.id,
          file: file,
          title: body.documentInfo.title,
          userId: userToken.sub,
        },
      });

      const userInfo = await this.userQueryService.findById(userToken.sub);

      const generatedQuestions =
        await this.aiExaminerService.generateMultipleChoiceQuestions({
          examiner: {
            instructions: `You are an examiner in ${userInfo.institution}`,
            name: 'Examiner',
          },
          filePath: createdDocument.data.fileLocation,
        });

      const savedQuestions = await this.createQuestionHandler.handle({
        payload: {
          courseDocumentId: createdDocument.data.id,
          data: generatedQuestions,
          userId: userToken.sub,
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
