import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateFlaggedQuestionRequest } from '../request/CreateFlaggedQuestionRequest';
import { CreateFlaggedQuestionResponse } from '../response/CreateFlaggedQuestionResponse';
import { CommandResponse } from '../response/CommandResponse';
import { FlaggedQuestionRepository } from 'src/business/repository/FlaggedQuestionRepository';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { FlaggedQuestionModel } from 'src/infra/db/models/FlaggedQuestionsModel';

@Injectable()
export class CreateFlaggedQuestionHandler extends AbstractRequestHandlerTemplate<
  CreateFlaggedQuestionRequest,
  CreateFlaggedQuestionResponse
> {
  constructor(
    @Inject(FlaggedQuestionRepository)
    private flaggedQuestionRepository: FlaggedQuestionRepository,
  ) {
    super();
  }

  protected async handleRequest(
    request: CreateFlaggedQuestionRequest,
  ): Promise<CommandResponse<CreateFlaggedQuestionResponse>> {
    try {
      const model = {
        testId: request.testId,
        selectedQuestionId: request.selectedQuestionId,
      } as FlaggedQuestionModel;

      const created = await this.flaggedQuestionRepository.create(model);

      return {
        data: { id: created.id },
        status: HttpStatus.CREATED,
        message: 'Question flagged successfully'
      };
    } catch (error) {
      throw new HandlerError('Failed to create flagged question').InnerError(
        error,
      );
    }
  }
}
