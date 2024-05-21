import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { UpdateScoreRequest } from '../request/UpdateScoreRequest';
import { UpdateScoreResponse } from '../response/UpdateScoreResponse';
import { ScoreRepository } from 'src/business/repository/ScoreRepository';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { ScoreModel } from 'src/infra/db/models/ScoreModel';

@Injectable()
export class UpdateScoreHandler extends AbstractRequestHandlerTemplate<
  UpdateScoreRequest,
  UpdateScoreResponse
> {
  constructor(
    @Inject(ScoreRepository) private scoreRepository: ScoreRepository,
  ) {
    super();
  }
  public async handleRequest(
    request: UpdateScoreRequest,
  ): Promise<CommandResponse<UpdateScoreResponse>> {
    try {
      const { payload } = request;
      const updatedScore = await this.scoreRepository.update({
        id: payload.id,
        score: payload.score,
        createdOn: payload.createdOn,
      } as ScoreModel);

      return {
        message: 'Score updated successfully',
        status: HttpStatus.CREATED,
        data: {
          id: updatedScore.id,
        },
      };
    } catch (error) {
      throw new HandlerError('Failed to handle score update').InnerError(error);
    }
  }
}
