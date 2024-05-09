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
} from '@nestjs/common';
import { CreateCourseDocumentHandler } from 'src/business/handlers/CourseDocument/CreateCourseDocumentHandler';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { Request } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { CreateCourseDocumentDto } from 'src/dto/CreateCourseDocumentDto';
import { CourseDocumentQueryService } from 'src/query/services/CourseDocumentQueryService';
import { GetAllCourseDocumentDto } from 'src/dto/GetAllCourseDocumentDto';

@Controller('course-document')
export class CourseDocumentController {
  constructor(
    @Inject(CreateCourseDocumentHandler)
    private createCourseDocumentHander: CreateCourseDocumentHandler,
    @Inject(CourseDocumentQueryService)
    private courseDocumentQueryService: CourseDocumentQueryService,
  ) {}

  @UseGuards(AuthGuard)
  @Get('')
  public async getAllCourseDocuments(
    @Body() body: GetAllCourseDocumentDto,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      return await this.courseDocumentQueryService.findAllUserCoursesDocumentsByCourseId(
        body.courseId,
        userToken.sub,
      );
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
    @Body() body: Omit<CreateCourseDocumentDto, 'userId'>,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      return await this.createCourseDocumentHander.handle({
        payload: {
          courseId: body.courseId,
          file: file,
          title: body.title,
          userId: userToken.sub,
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
