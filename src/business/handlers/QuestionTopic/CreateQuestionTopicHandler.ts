import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import { QuestionTopicRepository } from 'src/business/repository/QuestionTopicRepository';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateQuestionTopicRequest } from '../request/CreateQuestionTopicRequest';
import { CreateQuestionTopicRepsonse } from '../response/CreateQuestionTopicResponse';
import { CommandResponse } from '../response/CommandResponse';
import { QuestionTopicModel } from 'src/infra/db/models/QuestionTopicModel';

@Injectable()
export class CreateQuestionTopicHandler extends AbstractRequestHandlerTemplate<
  CreateQuestionTopicRequest,
  CreateQuestionTopicRepsonse
> {
  constructor(
    @Inject(QuestionTopicRepository)
    private questionTopicRepository: QuestionTopicRepository,
  ) {
    super();
  }

  public async handleRequest(
    request: CreateQuestionTopicRequest,
  ): Promise<CommandResponse<CreateQuestionTopicRepsonse>> {
    try {
      const createdQuestionTopics =
        await this.questionTopicRepository.bulkCreate(
          request.payload as QuestionTopicModel[],
        );

      return {
        data: { data: createdQuestionTopics },
        message: 'Question topics created successfully',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HandlerError(
        'Failed to handle question topic creation',
      ).InnerError(error);
    }
  }
}
