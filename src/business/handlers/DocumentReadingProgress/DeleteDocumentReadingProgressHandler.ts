import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CommandResponse } from '../response/CommandResponse';
import { DocumentReadingProgressRepository } from 'src/business/repository/DocumentReadingProgressRepository';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { DeleteDocumentReadingProgressRequest } from '../request/DeleteDocumentReadingProgressRequest';
import { DeleteDocumentReadingProgressResponse } from '../response/DeleteDocumentReadingProgressResponse';

@Injectable()
export class DeleteDocumentReadingProgressHandler extends AbstractRequestHandlerTemplate<
  DeleteDocumentReadingProgressRequest,
  DeleteDocumentReadingProgressResponse
> {
  constructor(
    @Inject('DOCUMENT_READING_PROGRESS_REPOSITORY')
    private readonly readingProgressRepository: DocumentReadingProgressRepository,
  ) {
    super();
  }

  protected async handleRequest(
    request: DeleteDocumentReadingProgressRequest,
  ): Promise<CommandResponse<DeleteDocumentReadingProgressResponse>> {
    try {
      await this.readingProgressRepository.delete(request.id)

      return {
        data: undefined,
        message: 'Progress deleted',
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HandlerError(
        'Failed to handle reading progress creation',
      ).InnerError(error);
    }
  }
}
