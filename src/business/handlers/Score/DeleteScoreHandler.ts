import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { DeleteScoreRequest } from '../request/DeleteScoreRequest';
import { DeleteScoreResponse } from '../response/DeleteScoreResponse';
import { CommandResponse } from '../response/CommandResponse';
import { ScoreRepository } from 'src/business/repository/ScoreRepository';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { ScoreQueryService } from 'src/query/services/ScoreQueryService';

@Injectable()
export class DeleteScoreHandler extends AbstractRequestHandlerTemplate<
  DeleteScoreRequest,
  DeleteScoreResponse
> {
  constructor(
    @Inject(ScoreRepository) private scoreRepository: ScoreRepository,
    @Inject(ScoreQueryService) private scoreQueryService: ScoreQueryService,
  ) {
    super();
  }

  protected async handleRequest(
    request: DeleteScoreRequest,
  ): Promise<CommandResponse<DeleteScoreResponse>> {
    try {
      const { scoreId, userId } = request;
      const score = await this.scoreQueryService.findScoreById(scoreId);

      if (!score) {
        throw new HttpException(
          `Score with id: ${scoreId} does not exist`,
          HttpStatus.NOT_FOUND,
        );
      }

      if (score.userId !== userId) {
        throw new HttpException(
          'User may delete only their score',
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.scoreRepository.delete(scoreId);

      return {
        data: null,
        message: 'score successfully deleted',
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HandlerError('Failed to handle score deletion').InnerError(
        error,
      );
    }
  }
}
