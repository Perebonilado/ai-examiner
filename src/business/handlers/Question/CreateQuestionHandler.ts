import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateQuestionRequest } from '../request/CreateQuestionRequest';
import { CreateQuestionResponse } from '../response/CreateQuestionResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { QuestionRepository } from 'src/business/repository/QuestionRepository';
import { QuestionModel } from 'src/infra/db/models/QuestionModel';

@Injectable()
export class CreateQuestionHandler extends AbstractRequestHandlerTemplate<
  CreateQuestionRequest,
  CreateQuestionResponse
> {
  constructor(
    @Inject(QuestionRepository) private questionRepository: QuestionRepository,
  ) {
    super();
  }

  public async handleRequest(
    request: CreateQuestionRequest,
  ): Promise<CommandResponse<CreateQuestionResponse>> {
    try {
      const payload = request.payload;
      const savedQuestion = await this.questionRepository.create({
        data: JSON.stringify(payload.data),
        userId: payload.userId,
        courseDocumentId: payload.courseDocumentId,
      } as QuestionModel);

      return {
        data: { id: savedQuestion.id },
        message: 'Questions Successfully created',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HandlerError('Failed to handle question creation').InnerError(
        error,
      );
    }
  }
}
