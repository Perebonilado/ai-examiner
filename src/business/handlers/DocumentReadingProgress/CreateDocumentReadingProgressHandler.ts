import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateDocumentReadingProgressRequest } from '../request/CreateDocumentReadingProgressRequest';
import { CommandResponse } from '../response/CommandResponse';
import { DocumentReadingProgressRepository } from 'src/business/repository/DocumentReadingProgressRepository';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { DocumentReadingProgressModel } from 'src/infra/db/models/DocumentReadingProgress';
import { CreateDocumentReadingProgressResponse } from '../response/CreateDocumentReadingProgressResponse';

@Injectable()
export class CreateDocumentReadingProgressHandler extends AbstractRequestHandlerTemplate<
  CreateDocumentReadingProgressRequest,
  CreateDocumentReadingProgressResponse
> {
  constructor(
    @Inject('DOCUMENT_READING_PROGRESS_REPOSITORY')
    private readonly readingProgressRepository: DocumentReadingProgressRepository,
  ) {
    super();
  }

  protected async handleRequest(
    request: CreateDocumentReadingProgressRequest,
  ): Promise<CommandResponse<CreateDocumentReadingProgressResponse>> {
    try {
      const modelToCreate = new DocumentReadingProgressModel({
        topicId: request.topicId,
        documentId: request.documentId,
      });
      const createdModel =
        await this.readingProgressRepository.create(modelToCreate);

      return {
        data: { id: createdModel.id },
        message: 'Progress saved',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HandlerError(
        'Failed to handle reading progress creation',
      ).InnerError(error);
    }
  }
}
