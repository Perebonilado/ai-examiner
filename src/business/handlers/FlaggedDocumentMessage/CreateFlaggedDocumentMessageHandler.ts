import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateFlaggedDocumentMessageRequest } from '../request/CreateFlaggedDocumentMessageRequest';
import { CreateFlaggedDocumentMessageResponse } from '../response/CreateFlaggedDocumentMessageResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { FlaggedDocumentMessageRepository } from 'src/business/repository/FlaggedDocumentMessageRepository';
import { FlaggedDocumentMessageModel } from 'src/infra/db/models/FlaggedDocumentMessageModel';

@Injectable()
export class CreateFlaggedMessageHandler extends AbstractRequestHandlerTemplate<
  CreateFlaggedDocumentMessageRequest,
  CreateFlaggedDocumentMessageResponse
> {
  constructor(
    @Inject(FlaggedDocumentMessageRepository)
    private flaggedDocumentMessageRepository: FlaggedDocumentMessageRepository,
  ) {
    super();
  }

  protected async handleRequest(
    request: CreateFlaggedDocumentMessageRequest,
  ): Promise<CommandResponse<CreateFlaggedDocumentMessageResponse>> {
    try {
      const created = await this.flaggedDocumentMessageRepository.create({
        documentMessageId: request.documentMessageId,
      } as FlaggedDocumentMessageModel);

      return {
        data: { id: created.id },
        status: HttpStatus.CREATED,
        message: 'Document Message flagged successfully',
      };
    } catch (error) {
      throw new HandlerError(
        'Failed to handle flagged doc message creation',
      ).InnerError(error);
    }
  }
}
