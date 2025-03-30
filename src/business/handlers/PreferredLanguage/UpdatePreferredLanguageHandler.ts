import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { UpdatePreferredLanguageRequest } from '../request/UpdatePreferredLanguageRequest';
import { UpdatePreferredLanguageResponse } from '../response/UpdatePreferredLanguageResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { PreferredLanguageQueryService } from 'src/query/services/PreferredLanguageQueryService';
import { PreferredLanguageRepository } from 'src/business/repository/PreferredLanguageRepository';
import { PreferredLanguageModel } from 'src/infra/db/models/PreferredLanguageModel';

@Injectable()
export class UpdatePreferredLanguageHandler extends AbstractRequestHandlerTemplate<
  UpdatePreferredLanguageRequest,
  UpdatePreferredLanguageResponse
> {
  constructor(
    @Inject(PreferredLanguageQueryService)
    private preferredLanguageQueryService: PreferredLanguageQueryService,
    @Inject(PreferredLanguageRepository)
    private preferredLanguageRepository: PreferredLanguageRepository,
  ) {
    super();
  }

  protected async handleRequest(
    request: UpdatePreferredLanguageRequest,
  ): Promise<CommandResponse<UpdatePreferredLanguageResponse>> {
    try {
      const existingLanguage =
        await this.preferredLanguageQueryService.findByUserId(request.userId);

      if (!existingLanguage) {
        throw new HttpException(
          'User dows not have language to update',
          HttpStatus.BAD_REQUEST,
        );
      } else {
        const updated = await this.preferredLanguageRepository.update({
          userId: existingLanguage.userId,
          language: request.language,
        } as PreferredLanguageModel);

        return {
          data: {
            id: updated.id,
          },
          message: 'Preferred language updated successfully',
          status: HttpStatus.CREATED,
        };
      }
    } catch (error) {
      throw new HandlerError('Failed to update preferred language').InnerError(
        error,
      );
    }
  }
}
