import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { UpdateOneTimeSubscriptionRequest } from '../request/UpdateOneTImeSubscriptionRequest';
import { UpdateOneTimeSubscriptionResponse } from '../response/UpdateOneTimeSubscriptionResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { OneTimeSubscriptionRepository } from 'src/business/repository/OneTimeSubscriptionRepository';
import { OneTimeSubscriptionModel } from 'src/infra/db/models/OneTimeSubscriptionModel';

@Injectable()
export class UpdateOneTimeSubscriptionHandler extends AbstractRequestHandlerTemplate<
  UpdateOneTimeSubscriptionRequest,
  UpdateOneTimeSubscriptionResponse
> {
  constructor(
    @Inject(OneTimeSubscriptionRepository)
    private oneTimeSubscriptionRepository: OneTimeSubscriptionRepository,
  ) {
    super();
  }

  protected async handleRequest(
    request: UpdateOneTimeSubscriptionRequest,
  ): Promise<CommandResponse<UpdateOneTimeSubscriptionResponse>> {
    try {
      await this.oneTimeSubscriptionRepository.update({
        planCode: request.planCode,
        userId: request.userId,
        expiresOn: request.expiresOn,
        id: request.id
      } as OneTimeSubscriptionModel);

      return {
        data: { planId: request.planCode },
        message: 'One time subscription successfully updated',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HandlerError(
        'Failed to handle one time subscription update',
      ).InnerError(error);
    }
  }
}
