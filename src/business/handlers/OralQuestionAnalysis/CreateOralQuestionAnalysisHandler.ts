import { HttpStatus, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateOralQuestionAnalysisRequest } from '../request/CreateOralQuestionAnalysisRequest';
import { CreateOralQuestionAnalysisResponse } from '../response/CreateOralQuestionAnalysisResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';

@Injectable()
export class CreateOralQuestionAnalysisHandler extends AbstractRequestHandlerTemplate<
  CreateOralQuestionAnalysisRequest,
  CreateOralQuestionAnalysisResponse
> {
  constructor() {
    super();
  }

  protected async handleRequest(
    request: CreateOralQuestionAnalysisRequest,
  ): Promise<CommandResponse<CreateOralQuestionAnalysisResponse>> {
    try {

      

      return {
        data: null,
        message: 'success',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HandlerError(
        'Failed to handle oral question analysis request',
      ).InnerError(error);
    }
  }
}
