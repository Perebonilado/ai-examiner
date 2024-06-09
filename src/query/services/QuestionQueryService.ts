import { Inject, Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { CourseDocumentModel } from 'src/infra/db/models/CourseDocumentModel';
import { QuestionModel } from 'src/infra/db/models/QuestionModel';
import { getPagination } from 'src/utils';
import { ScoreQueryService } from './ScoreQueryService';
import { QuestionTopicQueryService } from './QuestionTopicQueryService';
import { LookUpQueryService } from './LookUpQueryService';

@Injectable()
export class QuestionQueryService {
  constructor(
    @Inject(ScoreQueryService) private scoreQueryService: ScoreQueryService,
    @Inject(QuestionTopicQueryService)
    private questionTopicService: QuestionTopicQueryService,
    @Inject(LookUpQueryService) private lookUpQueryService: LookUpQueryService,
  ) {}

  public async findAllQuestionsByDocumentIdAndUserId(
    documentId: string,
    userId: string,
    pageSize: number,
    page: number,
  ) {
    try {
      const { limit, offset } = getPagination(page, pageSize);
      const totalCount = await QuestionModel.count({
        where: { courseDocumentId: documentId, userId },
      });
      const questions = await QuestionModel.findAll({
        where: { courseDocumentId: documentId, userId },
        order: [['created_on', 'DESC']],
        limit,
        offset,
      });

      const questionsWithScoresAndTopics = await Promise.all(
        questions.map(async (q) => {
          const score = await this.scoreQueryService.findScoreByQuestionId(
            q.id,
          );

          const topics =
            await this.questionTopicService.findQuestionTopicsByQuestionId(
              q.id,
            );

          const type = await this.lookUpQueryService.findLookUpById(
            q.questionTypeId,
          );

          return {
            ...q.get({ plain: true }),
            score: score ? score.score : null,
            topics: topics
              ? topics.map((t) => ({ id: t.id, title: t.documentTopicTitle }))
              : null,
            type: type ? type.title : null,
          };
        }),
      );

      return {
        questions: questionsWithScoresAndTopics,
        meta: {
          currentPage: page,
          pageSize,
          totalCount,
        },
      };
    } catch (error) {
      throw new QueryError('Failed to find questions').InnerError(error);
    }
  }

  public async findQuestionsById(id: string, userId: string) {
    try {
      const question = await QuestionModel.findOne({ where: { id, userId } });
      const courseDocument = await CourseDocumentModel.findOne({
        where: { id: question.courseDocumentId, userId },
      });
      const score = await this.scoreQueryService.findScoreByQuestionId(
        question.id,
      );
      const topics =
        await this.questionTopicService.findQuestionTopicsByQuestionId(id);

      const type = await this.lookUpQueryService.findLookUpById(
        question.questionTypeId,
      );

      return {
        id: question.id,
        documentTitle: courseDocument.title,
        documentId: courseDocument.id,
        createdOn: question.createdOn,
        questions: JSON.parse(question.data),
        score: score ? score.score : null,
        topics: topics
          ? topics.map((t) => ({ id: t.id, title: t.documentTopicTitle }))
          : null,
        type: type ? type.title : null
      };
    } catch (error) {
      throw new QueryError('Failed to find questions by id').InnerError(error);
    }
  }
}
