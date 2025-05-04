import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateRelatedVideoRequest } from '../request/CreateRelatedVideoRequest';
import { CreateRelatedVideoResponse } from '../response/CreateRelatedVideoResponse';
import { RelatedVideoRepository } from 'src/business/repository/RelatedVideoRepository';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { RelatedVideoModel } from 'src/infra/db/models/RelatedVideoModel';

@Injectable()
export class CreateRelatedVideoHandler extends AbstractRequestHandlerTemplate<
  CreateRelatedVideoRequest,
  CreateRelatedVideoResponse
> {
  constructor(
    @Inject(RelatedVideoRepository)
    private relatedVideoRepository: RelatedVideoRepository,
  ) {
    super();
  }

  protected async handleRequest(
    request: CreateRelatedVideoRequest,
  ): Promise<CommandResponse<CreateRelatedVideoResponse>> {
    try {
      const model = {
        data: JSON.stringify(request.data),
        source: request.source,
        documentId: request.documentId,
      } as RelatedVideoModel;

      const created = await this.relatedVideoRepository.create(model);

      return {
        data: { id: created.id },
        message: 'successfully created related video',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HandlerError(
        'Failed to handle related video creation',
      ).InnerError(error);
    }
  }
}
