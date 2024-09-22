import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { DeleteQuestionTopicsRequest } from '../request/DeleteQuestionTopicsRequest';
import { DeleteQuestionTopicResponse } from '../response/DeleteQuestionTopicResponse';
import { CommandResponse } from '../response/CommandResponse';
import { QuestionTopicRepository } from 'src/business/repository/QuestionTopicRepository';
import { HandlerError } from 'src/error-handlers/business/HandlerError';

@Injectable()
export class DeleteQuestionTopicHandler extends AbstractRequestHandlerTemplate<
  DeleteQuestionTopicsRequest,
  DeleteQuestionTopicResponse
> {
  constructor(
    @Inject(QuestionTopicRepository)
    private questionTopicRepository: QuestionTopicRepository,
  ) {
    super();
  }

  protected async handleRequest(
    request: DeleteQuestionTopicsRequest,
  ): Promise<CommandResponse<DeleteQuestionTopicResponse>> {
    try {
      const { questionTopicIds } = request;

      await this.questionTopicRepository.bulkDelete(questionTopicIds);

      return {
        data: null,
        message: 'Question Topics deleted successfully',
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HandlerError(
        'Failed to handle question topic deletion',
      ).InnerError(error);
    }
  }
}
