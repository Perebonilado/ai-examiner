import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateDocumentSummaryRequest } from '../request/CreateDocumentSummaryRequest';
import { CreateDocumentSummaryResponse } from '../response/CreateDocumentSummaryResponse';
import { DocumentSummaryRepository } from 'src/business/repository/DocumentSummaryRepository';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { DocumentSummaryModel } from 'src/infra/db/models/DocumentSummaryModel';

@Injectable()
export class CreateDocumentSummaryHandler extends AbstractRequestHandlerTemplate<
  CreateDocumentSummaryRequest,
  CreateDocumentSummaryResponse
> {
  constructor(
    @Inject(DocumentSummaryRepository)
    private documentSummaryRepository: DocumentSummaryRepository,
  ) {
    super();
  }

  protected async handleRequest(
    request: CreateDocumentSummaryRequest,
  ): Promise<CommandResponse<CreateDocumentSummaryResponse>> {
    try {
      const createdSummary = await this.documentSummaryRepository.create({
        summary: request.summary,
        documentId: request.documentId,
        userId: request.userId,
      } as DocumentSummaryModel);

      return {
        data: {
          id: createdSummary.id,
        },
        message: 'summary created',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HandlerError(
        'Failed to handle document summary creation',
      ).InnerError(error);
    }
  }
}
