import { Injectable, Inject } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { QuestionProgressModel } from 'src/infra/db/models/QuestionProgressModel';
import { ScoreQueryService } from './ScoreQueryService';
import { UpsertQuestionProgressDTO } from 'src/dto/UpsertQuestionProgressDto';
import { QueryTypes } from 'sequelize';
import { QuestionType } from 'src/infra/web/models/QuestionTypeModel';
import { PerformanceTrackingRawData } from 'src/infra/web/models/PerformanceTrackingModel';

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
        attributes: { exclude: ['userId', 'user_id'] },
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

  public async getPerformanceTrackingRawDataForQuestion(
    questionId: string,
    userId: string,
  ) {
    try {
      return (await QuestionProgressModel.sequelize.query(
        `
  SELECT 
      qp.data AS savedProgress, 
      qp.created_on, 
      qp.modified_on, 
      q.data AS questionData, 
      qp.status, 
      q.id AS questionId, 
      lk.title AS questionType
  FROM 
      question_progress qp
  INNER JOIN 
      question q 
      ON qp.question_id = q.id
  INNER JOIN 
      lookup lk 
      ON lk.id = q.question_type_id
  WHERE 
      qp.status = 'submitted'
      AND qp.user_id = :userId
      AND q.id = :questionId
        `,
        {
          type: QueryTypes.SELECT,
          replacements: {
            userId,
            questionId,
          },
        },
      )) as unknown as PerformanceTrackingRawData[];
    } catch (error) {
      throw new QueryError(
        'Failed to get performance tracking raw data for question',
      ).InnerError(error);
    }
  }

  public async getPreviousWeekProgress({
    userId,
    documentId,
    startDate,
    endDate,
  }: {
    userId: string;
    documentId: string;
    startDate: string;
    endDate: string;
  }) {
    try {
      return (await QuestionProgressModel.sequelize.query(
        `
  SELECT 
      qp.data AS savedProgress, 
      qp.created_on, 
      qp.modified_on, 
      q.data AS questionData, 
      qp.status, 
      q.id AS questionId, 
      lk.title AS questionType
  FROM 
      question_progress qp
  INNER JOIN 
      question q 
      ON qp.question_id = q.id
  INNER JOIN 
      lookup lk 
      ON lk.id = q.question_type_id
  WHERE 
      qp.status = 'submitted'
      AND qp.user_id = :userId
      AND q.course_document_id = :documentId
      AND (
          CASE 
              WHEN qp.modified_on IS NOT NULL THEN qp.modified_on 
              ELSE qp.created_on 
          END
      ) BETWEEN :startDate AND :endDate
        `,
        {
          type: QueryTypes.SELECT,
          replacements: {
            userId,
            startDate,
            endDate,
            documentId,
          },
        },
      )) as unknown as PerformanceTrackingRawData[];
    } catch (error) {
      throw new QueryError('Failed to get progress based on period').InnerError(
        error,
      );
    }
  }
}
