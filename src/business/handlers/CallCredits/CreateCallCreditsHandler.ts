import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateCallCreditsRequest } from '../request/CreateCallCreditsRequest';
import { CreateCallCreditsResponse } from '../response/CreateCallCreditsResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { CallCreditsRepository } from 'src/business/repository/CallCreditsRepository';
import { CallCreditsModel } from 'src/infra/db/models/CallCreditsModel';

@Injectable()
export class CreateCallCreditsHandler extends AbstractRequestHandlerTemplate<
  CreateCallCreditsRequest,
  CreateCallCreditsResponse
> {
  constructor(
    @Inject(CallCreditsRepository)
    private callCreditsRepository: CallCreditsRepository,
  ) {
    super();
  }

  protected async handleRequest(
    request: CreateCallCreditsRequest,
  ): Promise<CommandResponse<CreateCallCreditsResponse>> {
    try {
      const { timeToAddMs, userId } = request;
      const callCreditsPayload = {
        userId,
        remainingTimeMs: 0,
        totalTimePurchasedMs: 0,
        freeRemainingTimeMs: timeToAddMs,
        lastFreeTimeModifiedOn: new Date()
      } as CallCreditsModel;

      const createdCredits =
        await this.callCreditsRepository.create(callCreditsPayload);

      return {
        data: {
          id: createdCredits.id,
          reaminingCredits: createdCredits.remainingTimeMs,
          freeCredits: createdCredits.freeRemainingTimeMs
        },
        message: 'Call Credits Created',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HandlerError(
        'Failed to handle call credit creation request',
      ).InnerError(error);
    }
  }
}
