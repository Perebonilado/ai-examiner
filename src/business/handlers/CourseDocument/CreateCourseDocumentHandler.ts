import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateCourseDocumentRequest } from '../request/CreateCourseDocumentRequest';
import { CreateCourseDocumentResponse } from '../response/CreateCourseDocumentResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { CourseDocumentRepository } from 'src/business/repository/CourseDocumentRepository';
import { CourseDocumentModel } from 'src/infra/db/models/CourseDocumentModel';

@Injectable()
export class CreateCourseDocumentHandler extends AbstractRequestHandlerTemplate<
  CreateCourseDocumentRequest,
  CreateCourseDocumentResponse
> {
  constructor(
    @Inject(CourseDocumentRepository)
    private courseDocumentRepository: CourseDocumentRepository,
  ) {
    super();
  }

  public async handleRequest(
    request: CreateCourseDocumentRequest,
  ): Promise<CommandResponse<CreateCourseDocumentResponse>> {
    try {
      const payload = request.payload;
      const createdCourseDocument = await this.courseDocumentRepository.create({
        title: payload.title,
        courseId: payload.courseId,
        openAiFileId: payload.fileId,
        openAiThreadId: payload.threadId,
        userId: payload.userId,
      } as CourseDocumentModel);

      return {
        message: 'Document successfully created',
        status: HttpStatus.CREATED,
        data: {
          threadId: createdCourseDocument.openAiThreadId,
          fileId: createdCourseDocument.openAiFileId,
          id: createdCourseDocument.id,
        },
      };
    } catch (error) {
      throw new HandlerError(
        'Failed to handle Document creation',
      ).InnerError(error);
    }
  }
}
