import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreatePreferredLanguageRequest } from '../request/CreatePreferredLanguageRequest';
import { CreatePreferredLanguageResponse } from '../response/CreatePreferredLanguageResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { PreferredLanguageRepository } from 'src/business/repository/PreferredLanguageRepository';
import { PreferredLanguageModel } from 'src/infra/db/models/PreferredLanguageModel';

@Injectable()
export class CreatePreferredLanguageHandler extends AbstractRequestHandlerTemplate<
  CreatePreferredLanguageRequest,
  CreatePreferredLanguageResponse
> {
  constructor(
    @Inject(PreferredLanguageRepository)
    private preferredLanguageRepository: PreferredLanguageRepository,
  ) {
    super();
  }

  protected async handleRequest(
    request: CreatePreferredLanguageRequest,
  ): Promise<CommandResponse<CreatePreferredLanguageResponse>> {
    try {
      const created = await this.preferredLanguageRepository.create({
        userId: request.userId,
        language: request.language,
      } as PreferredLanguageModel);

      return {
        data: {
          id: created.id,
        },
        message: 'Preferred Language Saved',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HandlerError(
        'Failed to handle preferred language creation',
      ).InnerError(error);
    }
  }
}
