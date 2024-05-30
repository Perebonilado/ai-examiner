import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateDocumentTopicRequest } from '../request/CreateDocumentTopicRequest';
import { CreateDocumentTopicResponse } from '../response/CreateDocumentTopicResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { DocumentTopicRepository } from 'src/business/repository/DocumentTopicRepository';
import { DocumentTopicModel } from 'src/infra/db/models/DocumentTopicModel';

@Injectable()
export class CreateDocumentTopicHandler extends AbstractRequestHandlerTemplate<
  CreateDocumentTopicRequest,
  CreateDocumentTopicResponse
> {
  constructor(
    @Inject(DocumentTopicRepository)
    private documentTopicRepository: DocumentTopicRepository,
  ) {
    super();
  }

  public async handleRequest(
    request: CreateDocumentTopicRequest,
  ): Promise<CommandResponse<CreateDocumentTopicResponse>> {
    try {
      const { payload } = request;
      const createdTopics = await this.documentTopicRepository.bulkCreate(
        payload as DocumentTopicModel[],
      );

      return {
        data: { data: createdTopics },
        message: 'topics created',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      console.log(error)
      throw new HandlerError(
        'Failed to handle Document topic creation',
      ).InnerError(error);
    }
  }
}
