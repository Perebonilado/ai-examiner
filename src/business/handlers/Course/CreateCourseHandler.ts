import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateCourseRequest } from '../request/CreateCourseRequest';
import { CreateCourseResponse } from '../response/CreateCourseResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { CourseQueryService } from 'src/query/services/CourseQueryService';
import { CourseRepository } from 'src/business/repository/CourseRepository';
import { CourseModel } from 'src/infra/db/models/CourseModel';

@Injectable()
export class CreateCourseHandler extends AbstractRequestHandlerTemplate<
  CreateCourseRequest,
  CreateCourseResponse
> {
  constructor(
    @Inject(CourseQueryService) private courseQueryService: CourseQueryService,
    @Inject(CourseRepository) private courseRepository: CourseRepository,
  ) {
    super();
  }

  public async handleRequest(
    request: CreateCourseRequest,
  ): Promise<CommandResponse<CreateCourseResponse>> {
    try {
      const courseExists = await this.courseQueryService.findUserCourseByTitle(
        request.payload.title,
        request.payload.userId,
      );

      if (!courseExists) {
        const createdCourse = await this.courseRepository.create({
          title: request.payload.title,
          description: request.payload.description,
          userId: request.payload.userId,
        } as CourseModel);

        return {
          data: {
            description: createdCourse.description,
            id: createdCourse.id,
            title: createdCourse.title,
          },
          message: 'Course created successfully',
          status: HttpStatus.CREATED,
        };
      }

      throw new HttpException(
        'Course title already exists',
        HttpStatus.BAD_REQUEST,
      );
    } catch (error) {
      throw new HandlerError('Failed to handle course creation').InnerError(
        error,
      );
    }
  }
}
