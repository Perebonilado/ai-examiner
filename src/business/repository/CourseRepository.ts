import { CourseModel } from 'src/infra/db/models/CourseModel';

export const CourseRepository = Symbol('CourseRepository');

export interface CourseRepository {
  create(course: CourseModel): Promise<CourseModel>;
}
