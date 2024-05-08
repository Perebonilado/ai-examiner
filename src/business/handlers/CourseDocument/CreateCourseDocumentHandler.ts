import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateCourseDocumentRequest } from '../request/CreateCourseDocumentRequest';
import { CreateCourseDocumentResponse } from '../response/CreateCourseDocumentResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { CourseDocumentRepository } from 'src/business/repository/CourseDocumentRepository';
import { CourseDocumentModel } from 'src/infra/db/models/CourseDocumentModel';
import { StorageBucketService } from 'src/integrations/aws/services/StorageBucketService';

@Injectable()
export class CreateCourseDocumentHandler extends AbstractRequestHandlerTemplate<
  CreateCourseDocumentRequest,
  CreateCourseDocumentResponse
> {
  constructor(
    @Inject(CourseDocumentRepository)
    private courseDocumentRepository: CourseDocumentRepository,
    @Inject(StorageBucketService) private storageBucketService: StorageBucketService
  ) {
    super();
  }

  public async handleRequest(
    request: CreateCourseDocumentRequest,
  ): Promise<CommandResponse<CreateCourseDocumentResponse>> {
    try {
      const payload = request.payload;
      const uploadedFile = await this.storageBucketService.uploadFile(payload.file)
      const createdCourseDocument = await this.courseDocumentRepository.create({
        title: payload.title,
        courseId: payload.courseId,
        fileLocation: uploadedFile.fileLocation,
        userId: payload.userId,
      } as CourseDocumentModel);

      return {
        message: 'Course document successfully created',
        status: HttpStatus.CREATED,
        data: {
          fileLocation: createdCourseDocument.fileLocation,
          id: createdCourseDocument.id,
        },
      };
    } catch (error) {
      throw new HandlerError(
        'Failed to handle course document creation',
      ).InnerError(error);
    }
  }
}
