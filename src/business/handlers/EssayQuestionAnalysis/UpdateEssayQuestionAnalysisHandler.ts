import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { UpdateEssayQuestionAnalysisRequest } from '../request/UpdateEssayQuestionAnalysisRequest';
import { UpdateEssayQuestionAnalysisResponse } from '../response/UpdateEssayQuestionAnalysisResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { EssayQuestionAnalysisRepository } from 'src/business/repository/EssayQuestionAnalysisRepository';
import { EssayQuestionAnalysisQueryService } from 'src/query/services/EssayQuestionAnalysisQueryService';
import { EssayQuestionAnalysisModel } from 'src/infra/db/models/EssayQuestionAnalysisModel';

@Injectable()
export class UpdateEssayQuestionAnalysisHandler extends AbstractRequestHandlerTemplate<
  UpdateEssayQuestionAnalysisRequest,
  UpdateEssayQuestionAnalysisResponse
> {
  constructor(
    @Inject(EssayQuestionAnalysisRepository)
    private essayQuestionAnalysisRepository: EssayQuestionAnalysisRepository,
    @Inject(EssayQuestionAnalysisQueryService)
    private essayQuestionAnalysisQueryService: EssayQuestionAnalysisQueryService,
  ) {
    super();
  }

  protected async handleRequest(
    request: UpdateEssayQuestionAnalysisRequest,
  ): Promise<CommandResponse<UpdateEssayQuestionAnalysisResponse>> {
    try {
      const { analysis, id, status, score, question, answer } = request;

      const existingModel =
        await this.essayQuestionAnalysisQueryService.findById(id);

      if (!existingModel)
        throw new HttpException(
          'question analysis does not exist',
          HttpStatus.BAD_REQUEST,
        );

      const modelToUpdate = {
        id: id,
        question: question,
        answer: answer,
        analysis: analysis,
        status: status,
        score: score,
      } as EssayQuestionAnalysisModel;

      const updated =
        await this.essayQuestionAnalysisRepository.update(modelToUpdate);

      return {
        data: {
          id: updated.id,
        },
        message: 'Analysis updated',
        status: HttpStatus.OK,
      };
    } catch (error) {
      console.log(error);
      throw new HandlerError('Failed to update essay analysis').InnerError(
        error,
      );
    }
  }
}
