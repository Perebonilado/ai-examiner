import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateEssayQuestionAnalysisRequest } from '../request/CreateEssayQuestionAnalysisRequest';
import { CreateEssayQuestionAnalysisResponse } from '../response/CreateEssayQuestionAnalysisResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { EssayQuestionAnalysisRepository } from 'src/business/repository/EssayQuestionAnalysisRepository';
import { EssayQuestionAnalysisModel } from 'src/infra/db/models/EssayQuestionAnalysisModel';

@Injectable()
export class CreateEssayQuestionAnalysisHandler extends AbstractRequestHandlerTemplate<
  CreateEssayQuestionAnalysisRequest,
  CreateEssayQuestionAnalysisResponse
> {
  constructor(
    @Inject(EssayQuestionAnalysisRepository)
    private essayQuestionAnalysisRepository: EssayQuestionAnalysisRepository,
  ) {
    super();
  }

  protected async handleRequest(
    request: CreateEssayQuestionAnalysisRequest,
  ): Promise<CommandResponse<CreateEssayQuestionAnalysisResponse>> {
    try {
      const { analysis, question, questionId, status, score, answer } = request;
      const modelToCreate = {
        question,
        analysis,
        status,
        questionId,
        score,
        answer
      } as EssayQuestionAnalysisModel;

      const created =
        await this.essayQuestionAnalysisRepository.create(modelToCreate);

      return {
        data: { id: created.id },
        message: 'Successfully created',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HandlerError(
        'Failed to handle essay analysis creation',
      ).InnerError(error);
    }
  }
}
