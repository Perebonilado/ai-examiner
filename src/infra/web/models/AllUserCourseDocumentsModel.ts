import { CourseDocumentModel } from 'src/infra/db/models/CourseDocumentModel';
import { MetaModel } from './meta.model';

export interface AllUserCourseDocumentsModel {
  courseDocuments: CourseDocumentModel[];
  meta: MetaModel;
}
