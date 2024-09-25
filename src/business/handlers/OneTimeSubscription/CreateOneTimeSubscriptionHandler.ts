import { Injectable, Inject } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateOneTimeSubscriptionRequest } from '../request/CreateOneTimeSubscriptionRequest';
import { CreateOneTimeSubscriptionResponse } from '../response/CreateOneTimeSubscriptionResponse';
import { CommandResponse } from '../response/CommandResponse';

@Injectable()
export class CreateOneTimeSubscriptionHandler extends AbstractRequestHandlerTemplate<
  CreateOneTimeSubscriptionRequest,
  CreateOneTimeSubscriptionResponse
> {
  constructor() {
    super();
  }

  protected async handleRequest(
    request: CreateOneTimeSubscriptionRequest,
  ): Promise<CommandResponse<CreateOneTimeSubscriptionResponse>> {
    try {
        
    } catch (error) {
        
    }
  }
}
