import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { UpdateCourseDocumentRequest } from '../request/UpdateCourseDocumentRequest';
import { UpdateCourseDocumentResponse } from '../response/UpdateCourseDocumentResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { CourseDocumentQueryService } from 'src/query/services/CourseDocumentQueryService';
import { CourseDocumentRepository } from 'src/business/repository/CourseDocumentRepository';
import { CourseDocumentModel } from 'src/infra/db/models/CourseDocumentModel';

@Injectable()
export class UpdateCourseDocumentHandler extends AbstractRequestHandlerTemplate<
  UpdateCourseDocumentRequest,
  UpdateCourseDocumentResponse
> {
  constructor(
    @Inject(CourseDocumentQueryService)
    private courseDocumentQueryService: CourseDocumentQueryService,
    @Inject(CourseDocumentRepository)
    private courseDocumentRepository: CourseDocumentRepository,
  ) {
    super();
  }

  protected async handleRequest(
    request: UpdateCourseDocumentRequest,
  ): Promise<CommandResponse<UpdateCourseDocumentResponse>> {
    try {
      const existingDoc =
        await this.courseDocumentQueryService.findCourseDocumentById(
          request.data.id,
          request.userId,
        );

      if (!existingDoc) {
        throw new HttpException(
          'Failed to find course document',
          HttpStatus.NOT_FOUND,
        );
      }

      await this.courseDocumentRepository.update({
        id: request.data.id,
        title: request.data?.title || existingDoc.title,
        isDeleted: request.data?.isDeleted || existingDoc.isDeleted,
      } as CourseDocumentModel);

      return {
        data: null,
        message: 'Update successful',
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HandlerError(
        'Failed to update course document request',
      ).InnerError(error);
    }
  }
}
