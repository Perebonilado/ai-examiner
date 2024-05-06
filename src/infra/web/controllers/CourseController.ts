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
} from '@nestjs/common';
import { Request } from 'express';
import { CreateCourseHandler } from 'src/business/handlers/Course/CreateCourseHandler';
import { CreateCourseDto } from 'src/dto/CreateCourseDto';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { CourseQueryService } from 'src/query/services/CourseQueryService';

@Controller('course')
export class CourseController {
  constructor(
    @Inject(CourseQueryService) private courseQueryService: CourseQueryService,
    @Inject(CreateCourseHandler)
    private createCourseHandler: CreateCourseHandler,
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
}
