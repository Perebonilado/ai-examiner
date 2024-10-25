import { Injectable, Inject } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { QuestionProgressModel } from 'src/infra/db/models/QuestionProgressModel';
import { ScoreQueryService } from './ScoreQueryService';
import { UpsertQuestionProgressDTO } from 'src/dto/UpsertQuestionProgressDto';

@Injectable()
export class QuestionProgressQueryService {
  constructor(
    @Inject(ScoreQueryService)
    private scoreQueryService: ScoreQueryService,
  ) {}

  public async findProgressByQuestionId(questionId: string) {
    try {
      const progress = await QuestionProgressModel.findOne({
        where: { questionId },
        attributes: {exclude: ['userId', 'user_id']},
        raw: true,
      });

      if (progress) {
        const score =
          await this.scoreQueryService.findScoreByQuestionId(questionId);

        return {
          ...progress,
          data: progress.data
            ? (JSON.parse(progress.data) as UpsertQuestionProgressDTO[])
            : null,
          score: score ? score.score : null,
        };
      }

      return null;
    } catch (error) {
      throw new QueryError('Failed to find progress by question id').InnerError(
        error,
      );
    }
  }
}
