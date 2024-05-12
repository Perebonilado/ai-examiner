import { CourseModel } from 'src/infra/db/models/CourseModel';
import { MetaModel } from './meta.model';

export interface AllUserCoursesModel {
  courses: CourseModel[];
  meta: MetaModel;
}

