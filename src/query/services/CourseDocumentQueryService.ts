import { Inject, Injectable } from '@nestjs/common';
import { Op } from 'sequelize';
import QueryError from 'src/error-handlers/query/QueryError';
import { CourseDocumentModel } from 'src/infra/db/models/CourseDocumentModel';
import { QuestionModel } from 'src/infra/db/models/QuestionModel';
import { getPagination } from 'src/utils';
import { ScoreQueryService } from './ScoreQueryService';

@Injectable()
export class CourseDocumentQueryService {
  constructor(
    @Inject(ScoreQueryService) private scoreQueryService: ScoreQueryService,
  ) {}

  public async findAllUserCoursesDocuments(
    id: string,
    courseId: string,
    title: string,
    userId: string,
    pageSize: number,
    page: number,
  ) {
    try {
      const { limit, offset } = getPagination(page, pageSize);

      const totalCount = await CourseDocumentModel.count({
        where: { userId, courseId },
      });
      const courseIdQuery = courseId ? { courseId } : {};
      const idQuery = id ? { id } : {};

      const docs = await CourseDocumentModel.findAll({
        where: {
          [Op.and]: [
            idQuery,
            courseIdQuery,
            { userId },
            { title: { [Op.like]: `%${title}%` } },
          ],
        },
        order: [['created_on', 'DESC']],
        limit,
        offset,
        include: [{ model: QuestionModel, attributes: ['id'] }],
      });

      const docsWithScores = await Promise.all(
        docs.map(async (d) => {
          const scores = await this.scoreQueryService.findScoresByDocumentId(
            d.id,
          );

          if (scores.length) {
            const scoreValues = scores.map((sc) => sc.score);
            const totalScores = scoreValues.reduce(
              (acc, curr) => acc + curr,
              0,
            );
            const averageScore = totalScores / scoreValues.length;

            return { ...d.get({plain: true}), averageScore}
          }

          return { averageScore: null, ...d.get({plain: true}) };
        }),
      );

      return {
        courseDocuments: docsWithScores,
        meta: {
          currentPage: page,
          pageSize,
          totalCount,
        },
      };
    } catch (error) {
      throw new QueryError('Failed to find all course documents').InnerError(
        error,
      );
    }
  }

  public async findCourseDocumentById(id: string, userId: string) {
    try {
      return await CourseDocumentModel.findOne({ where: { id, userId } });
    } catch (error) {
      throw new QueryError('Failed to find course documents by id').InnerError(
        error,
      );
    }
  }
}
