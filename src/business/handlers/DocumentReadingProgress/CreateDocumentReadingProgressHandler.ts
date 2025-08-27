import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateDocumentReadingProgressRequest } from '../request/CreateDocumentReadingProgressRequest';
import { CommandResponse } from '../response/CommandResponse';
import {
  DocumentReadingProgressRepository,
  documentReadingProgressRepository,
} from 'src/business/repository/DocumentReadingProgressRepository';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { DocumentReadingProgressModel } from 'src/infra/db/models/DocumentReadingProgress';
import { CreateDocumentReadingProgressResponse } from '../response/CreateDocumentReadingProgressResponse';

@Injectable()
export class CreateDocumentReadingProgressHandler extends AbstractRequestHandlerTemplate<
  CreateDocumentReadingProgressRequest,
  CreateDocumentReadingProgressResponse
> {
  constructor(
    @Inject(documentReadingProgressRepository)
    private readonly readingProgressRepository: DocumentReadingProgressRepository,
  ) {
    super();
  }

  protected async handleRequest(
    request: CreateDocumentReadingProgressRequest,
  ): Promise<CommandResponse<CreateDocumentReadingProgressResponse>> {
    try {
      const modelsToCreate = request.topicIds.map((topicId) => {
        return {
          topicId: topicId,
          documentId: request.documentId,
        } as DocumentReadingProgressModel;
      });

      const createdModel =
        await this.readingProgressRepository.bulkCreate(modelsToCreate);

      return {
        data: { ids: createdModel.map((m) => m.id) },
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
