import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { UpsertQuestionProgressRequest } from '../request/UpsertQuestionProgressRequest';
import { UpsertQuestionProgressResponse } from '../response/UpsertQuestionProgressReponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { QuestionProgressQueryService } from 'src/query/services/QuestionProgressQueryService';
import { QuestionProgressRepository } from 'src/business/repository/QuestionProgressRepository';
import { QuestionProgressModel } from 'src/infra/db/models/QuestionProgressModel';

@Injectable()
export class UpserQuestionProgressHandler extends AbstractRequestHandlerTemplate<
  UpsertQuestionProgressRequest,
  UpsertQuestionProgressResponse
> {
  constructor(
    @Inject(QuestionProgressQueryService)
    private questionProgressQueryService: QuestionProgressQueryService,
    @Inject(QuestionProgressRepository)
    private questionProgressRepository: QuestionProgressRepository,
  ) {
    super();
  }

  protected async handleRequest(
    request: UpsertQuestionProgressRequest,
  ): Promise<CommandResponse<UpsertQuestionProgressResponse>> {
    try {
      const { data, questionId, userId, status, clearExistingProgress } = request;

      const existingProgress =
        await this.questionProgressQueryService.findProgressByQuestionId(
          questionId,
        );

      let dataToSave: string | null = data ? JSON.stringify(data) : JSON.stringify(existingProgress.data)

      if(clearExistingProgress) {
        dataToSave = null
      }

      if (existingProgress) {
        await this.questionProgressRepository.upsert({
          id: existingProgress.id,
          data: dataToSave,
          questionId: questionId,
          userId: userId,
          status: status
        } as QuestionProgressModel);
      } else {
        await this.questionProgressRepository.upsert({
          data: JSON.stringify(data),
          questionId: questionId,
          userId: userId,
        } as QuestionProgressModel);
      }

      return {
        data: null,
        message: 'Successful',
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HandlerError(
        'Failed to handle question progress upsert',
      ).InnerError(error);
    }
  }
}
