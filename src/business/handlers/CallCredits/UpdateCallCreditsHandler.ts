import { Injectable, Inject, HttpStatus, HttpException } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { UpdateCallCreditsRequest } from '../request/UpdateCallCreditsRequest';
import { UpdateCallCreditsResponse } from '../response/UpdateCallCreditsResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { CallCreditsQueryService } from 'src/query/services/CallCreditsQueryService';
import { CallCreditsModel } from 'src/infra/db/models/CallCreditsModel';
import { CallCreditsRepository } from 'src/business/repository/CallCreditsRepository';

@Injectable()
export class UpdateCallCreditsHandler extends AbstractRequestHandlerTemplate<
  UpdateCallCreditsRequest,
  UpdateCallCreditsResponse
> {
  constructor(
    @Inject(CallCreditsQueryService)
    private callCreditsQueryService: CallCreditsQueryService,
    @Inject(CallCreditsRepository)
    private callCreditsRepository: CallCreditsRepository,
  ) {
    super();
  }

  protected async handleRequest(
    request: UpdateCallCreditsRequest,
  ): Promise<CommandResponse<UpdateCallCreditsResponse>> {
    try {
      const { action, timeToUpdate, userId } = request;
      const existingCallCredits =
        await this.callCreditsQueryService.findByUserId(userId);

      if (!existingCallCredits) {
        throw new HttpException(
          'User does not have existing call credits',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (action === 'add_reamining_time') {
        const newRemainingTime =
          existingCallCredits.remainingTimeMs + timeToUpdate;
        const newTotalTimePurchased =
          existingCallCredits.totalTimePurchasedMs + timeToUpdate;

        const payload = {
          id: existingCallCredits.id,
          remainingTimeMs: newRemainingTime,
          totalTimePurchasedMs: newTotalTimePurchased,
        } as CallCreditsModel;

        await this.callCreditsRepository.update(payload);
      } else {
        const subtractedTime =
          existingCallCredits.remainingTimeMs - timeToUpdate;
        const newRemainingTime = subtractedTime >= 0 ? subtractedTime : 0;

        const payload = {
          id: existingCallCredits.id,
          remainingTimeMs: newRemainingTime,
          totalTimePurchasedMs: existingCallCredits.totalTimePurchasedMs,
        } as CallCreditsModel;

        await this.callCreditsRepository.update(payload);
      }

      return {
        data: null,
        message: 'Call credits updated',
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HandlerError('Failed to update call credits data').InnerError(
        error,
      );
    }
  }
}
