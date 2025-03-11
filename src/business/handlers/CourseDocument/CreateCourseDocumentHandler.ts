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
        userId: payload.userId,

        mcqDirectEasyThreadId: payload.mcqDirectEasyThreadId,
        mcqDirectMediumThreadId: payload.mcqDirectMediumThreadId,
        mcqDirectHardThreadId: payload.mcqDirectHardThreadId,

        mcqUseCaseEasyThreadId: payload.mcqUseCaseEasyThreadId,
        mcqUseCaseMediumThreadId: payload.mcqUseCaseMediumThreadId,
        mcqUseCaseHardThreadId: payload.mcqUseCaseHardThreadId,

        multipleTrueFalseEasyThreadId: payload.multipleTrueFalseEasyThreadId,
        multipleTrueFalseMediumThreadId:
          payload.multipleTrueFalseMediumThreadId,
        multipleTrueFalseHardThreadId: payload.multipleTrueFalseHardThreadId,

        flashCardEasyThreadId: payload.flashCardEasyThreadId,
        flashCardMediumThreadId: payload.flashCardMediumThreadId,
        flashCardHardThreadId: payload.flashCardHardThreadId,

        documentChatThreadId: payload.documentChatThreadId,
        oralQuestionThreadId: payload.oralQuestionThreadId,
      } as CourseDocumentModel);

      return {
        message: 'Document successfully created',
        status: HttpStatus.CREATED,
        data: {
          fileId: createdCourseDocument.openAiFileId,
          id: createdCourseDocument.id,
        },
      };
    } catch (error) {
      throw new HandlerError('Failed to handle Document creation').InnerError(
        error,
      );
    }
  }
}
