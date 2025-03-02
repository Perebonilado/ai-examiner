import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateOralQuestionAnalysisRequest } from '../request/CreateOralQuestionAnalysisRequest';
import { CreateOralQuestionAnalysisResponse } from '../response/CreateOralQuestionAnalysisResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { OralQuestionAnalysisRepository } from 'src/business/repository/OralQuestionAnalysisRepository';
import { OralQuestionAnalysisModel } from 'src/infra/db/models/OralQuestionAnalysisModel';
import { CallAssistantMetaData } from 'src/integrations/vapi/models/InitiateCallModel';

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
      const questionId = (
        request.data.message.assistant
          .metadata as unknown as CallAssistantMetaData
      ).questionId;
      
      const createdAnalysis = await this.oralQuestionAnalysisRepository.create({
        callId: request.data.message.call.id,
        analysisData: '',
        questionId,
      } as OralQuestionAnalysisModel);

      return {
        data: { questionId },
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
