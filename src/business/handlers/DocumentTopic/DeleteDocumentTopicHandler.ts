import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { DeleteDocumentTopicRequest } from '../request/DeleteDocumentTopicRequest';
import { DeleteDocumentTopicResponse } from '../response/DeleteDocumentTopicResponse';
import { DocumentTopicRepository } from 'src/business/repository/DocumentTopicRepository';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { DocumentTopicQueryService } from 'src/query/services/DocumentTopicQueryService';

@Injectable()
export class DeleteDocumentTopicHandler extends AbstractRequestHandlerTemplate<
  DeleteDocumentTopicRequest,
  DeleteDocumentTopicResponse
> {
  constructor(
    @Inject(DocumentTopicRepository)
    private documentTopicRepository: DocumentTopicRepository,
    @Inject(DocumentTopicQueryService)
    private documentTopicQueryService: DocumentTopicQueryService,
  ) {
    super();
  }

  public async handleRequest(
    request: DeleteDocumentTopicRequest,
  ): Promise<CommandResponse<DeleteDocumentTopicResponse>> {
    try {
      const documentTopic =
        await this.documentTopicQueryService.findDocumentTopicById(
          request.payload.id,
        );

      if (documentTopic) {
        await this.documentTopicRepository.delete(documentTopic);

        return {
          data: null,
          message: 'topic deleted successfully',
          status: HttpStatus.OK,
        };
      } else {
        throw new HttpException(
          'Document topic does not exist',
          HttpStatus.NOT_FOUND,
        );
      }
    } catch (error) {
      throw new HandlerError(
        'Failed to handle Document Topic Creation',
      ).InnerError(error);
    }
  }
}
