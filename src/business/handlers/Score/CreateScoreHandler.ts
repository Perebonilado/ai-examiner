import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateScoreRequest } from '../request/CreateScoreRequest';
import { CreateScoreResponse } from '../response/CreateScoreResponse';
import { ScoreRepository } from 'src/business/repository/ScoreRepository';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { ScoreModel } from 'src/infra/db/models/ScoreModel';

@Injectable()
export class CreateScoreHandler extends AbstractRequestHandlerTemplate<
  CreateScoreRequest,
  CreateScoreResponse
> {
  constructor(
    @Inject(ScoreRepository) private scoreRepository: ScoreRepository,
  ) {
    super();
  }

  public async handleRequest(
    request: CreateScoreRequest,
  ): Promise<CommandResponse<CreateScoreResponse>> {
    try {
      const { payload } = request;
      const createdScore = await this.scoreRepository.create({
        score: payload.score,
        documentId: payload.documentId,
        questionId: payload.questionId,
        userId: payload.userId
      } as ScoreModel);

      return {
        message: 'Score created successfully',
        status: HttpStatus.CREATED,
        data: {
          id: createdScore.id,
        },
      };
    } catch (error) {
      throw new HandlerError('Failed to handle score creation').InnerError(
        error,
      );
    }
  }
}
