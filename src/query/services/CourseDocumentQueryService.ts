import { Injectable } from '@nestjs/common';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize';
import QueryError from 'src/error-handlers/query/QueryError';
import { CourseDocumentModel } from 'src/infra/db/models/CourseDocumentModel';
import { QuestionModel } from 'src/infra/db/models/QuestionModel';
import { AllUserCourseDocumentsModel } from 'src/infra/web/models/AllUserCourseDocumentsModel';
import { getPagination } from 'src/utils';

@Injectable()
export class CourseDocumentQueryService {
  constructor() {}

  public async findAllUserCoursesDocuments(
    id: string,
    courseId: string,
    title: string,
    userId: string,
    pageSize: number,
    page: number,
  ): Promise<AllUserCourseDocumentsModel> {
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
        include: [{ model: QuestionModel, attributes: [], duplicating: false }],
        attributes: {
          include: [
            [
              Sequelize.fn('COUNT', Sequelize.col('Question.id')),
              'questionCount',
            ],
          ],
        },
        group: ['CourseDocumentModel.id'],
      });

      return {
        courseDocuments: docs,
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
