import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { CourseQueryService } from 'src/query/services/CourseQueryService';

@Controller('course')
export class CourseController {
  constructor(
    @Inject(CourseQueryService) private courseQueryService: CourseQueryService,
  ) {}

  @UseGuards(AuthGuard)
  @Get('')
  public async getAllCourses(@Req() request: Request) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      return await this.courseQueryService.findAllUserCourses(userToken.sub);
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to login user',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
