import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateOralQuestionAnalysisRequest } from '../request/CreateOralQuestionAnalysisRequest';
import { CreateOralQuestionAnalysisResponse } from '../response/CreateOralQuestionAnalysisResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { OralQuestionAnalysisRepository } from 'src/business/repository/OralQuestionAnalysisRepository';
import { OralQuestionAnalysisModel } from 'src/infra/db/models/OralQuestionAnalysisModel';

@Injectable()
export class CreateOralQuestionAnalysisHandler extends AbstractRequestHandlerTemplate<
  CreateOralQuestionAnalysisRequest,
  CreateOralQuestionAnalysisResponse
> {
  constructor(
    @Inject(OralQuestionAnalysisRepository)
    private oralQuestionAnalysisRepository: OralQuestionAnalysisRepository,
  ) {
    super();
  }

  protected async handleRequest(
    request: CreateOralQuestionAnalysisRequest,
  ): Promise<CommandResponse<CreateOralQuestionAnalysisResponse>> {
    try {
      console.log('create oral question request', request)
      // const createdAnalysis = await this.oralQuestionAnalysisRepository.create({
      //   callId: request.data.call.id,
      //   analysisData: '',
      //   questionId: '',
      // } as OralQuestionAnalysisModel);

      return {
        data: { questionId: '' },
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
