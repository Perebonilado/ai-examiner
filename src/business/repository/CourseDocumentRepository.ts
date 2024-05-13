import { CourseDocumentModel } from "src/infra/db/models/CourseDocumentModel"


export const CourseDocumentRepository = Symbol('CourseDocumentRepository')

export interface CourseDocumentRepository {
    create(courseDocument: CourseDocumentModel): Promise<CourseDocumentModel>
}