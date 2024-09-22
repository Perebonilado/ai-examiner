import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { DeleteQuestionRequest } from '../request/DeleteQuestionRequest';
import { DeleteQuestionResponse } from '../response/DeleteQuestionReponse';
import { CommandResponse } from '../response/CommandResponse';
import { QuestionRepository } from 'src/business/repository/QuestionRepository';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { QuestionQueryService } from 'src/query/services/QuestionQueryService';
import { DeleteScoreHandler } from '../Score/DeleteScoreHandler';
import { DeleteQuestionTopicHandler } from '../QuestionTopic/DeleteQuestionTopicHandler';
import { QuestionTopicQueryService } from 'src/query/services/QuestionTopicQueryService';
import { ScoreQueryService } from 'src/query/services/ScoreQueryService';

@Injectable()
export class DeleteQuestionHandler extends AbstractRequestHandlerTemplate<
  DeleteQuestionRequest,
  DeleteQuestionResponse
> {
  constructor(
    @Inject(QuestionRepository) private questionRepository: QuestionRepository,
    @Inject(QuestionQueryService)
    private questionQueryService: QuestionQueryService,
    @Inject(DeleteScoreHandler) private deleteScoreHandler: DeleteScoreHandler,
    @Inject(DeleteQuestionTopicHandler)
    private deleteQuestionTopicHandler: DeleteQuestionTopicHandler,
    @Inject(QuestionTopicQueryService)
    private questionTopicQueryService: QuestionTopicQueryService,
    @Inject(ScoreQueryService) private scoreQueryService: ScoreQueryService,
  ) {
    super();
  }

  protected async handleRequest(
    request: DeleteQuestionRequest,
  ): Promise<CommandResponse<DeleteQuestionResponse>> {
    try {
      const { questionId, userId } = request;

      const question =
        await this.questionQueryService.getQuestionById(questionId);

      if (!question) {
        throw new HttpException(
          'Question does not exist',
          HttpStatus.NOT_FOUND,
        );
      }

      if (question.userId !== userId) {
        throw new HttpException(
          'User may only delete questions that belong to them',
          HttpStatus.BAD_REQUEST,
        );
      }
      const questionTopics =
        await this.questionTopicQueryService.findQuestionTopicsByQuestionId(
          question.id,
        );

      if (questionTopics) {
        await this.deleteQuestionTopicHandler.handle({
          questionTopicIds: questionTopics.map((qt) => qt.id),
        });
      }

      const questionScore = await this.scoreQueryService.findScoreByQuestionId(
        question.id,
      );

      if (questionScore) {
        await this.deleteScoreHandler.handle({
          scoreId: questionScore.id,
          userId,
        });
      }

      await this.questionRepository.delete(question.id);

      return {
        data: null,
        message: 'Question successfully deleted',
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HandlerError('Failed to handle question deletion').InnerError(
        error,
      );
    }
  }
}
