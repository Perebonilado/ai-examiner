import { Injectable } from '@nestjs/common';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize';
import QueryError from 'src/error-handlers/query/QueryError';
import { CourseDocumentModel } from 'src/infra/db/models/CourseDocumentModel';
import { CourseModel } from 'src/infra/db/models/CourseModel';
import { AllUserCoursesModel } from 'src/infra/web/models/AllUserCoursesModel.model';
import { getPagination } from 'src/utils';

@Injectable()
export class CourseQueryService {
  constructor() {}

  public async findCourseById(userId: string, courseId) {
    try {
      return await CourseModel.findOne({ where: { userId, id: courseId } });
    } catch (error) {
      throw new QueryError('Failed to find user course by id').InnerError(
        error,
      );
    }
  }

  public async findAllUserCourses(
    title: string,
    userId: string,
    pageSize: number,
    page: number,
  ): Promise<AllUserCoursesModel> {
    try {
      const { limit, offset } = getPagination(page, pageSize);
      const totalCount = await CourseModel.count({ where: { userId } });
      const courses = await CourseModel.findAll({
        where: {
          [Op.and]: [{ userId }, { title: { [Op.like]: `%${title}%` } }],
        },
        order: [['created_on', 'DESC']],
        limit,
        offset,
        include: [
          {
            model: CourseDocumentModel,
            attributes: ['id'],
          },
        ],
      });

      return {
        courses: courses,
        meta: {
          currentPage: page,
          pageSize,
          totalCount,
        },
      };
    } catch (error) {
      throw new QueryError('Failed to find user courses').InnerError(error);
    }
  }

  public async findUserCourseByTitle(title: string, userId: string) {
    try {
      return await CourseModel.findOne({ where: { title, userId } });
    } catch (error) {
      throw new QueryError(
        'Failed to find course by title ' + title,
      ).InnerError(error);
    }
  }
}
