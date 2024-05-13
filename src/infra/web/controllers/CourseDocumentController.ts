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
import { CreateQuestionHandler } from 'src/business/handlers/Question/CreateQuestionHandler';
import { ExaminerService } from 'src/integrations/open-ai/services/ExaminerService';


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
        error?.response ?? 'Failed to find course documents',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('')
  @UseInterceptors(FileInterceptor('document'))
  public async createCourseDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Omit<CreateCourseDocumentDto, 'userId' | 'threadId' | 'fileId'>,
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
