import { UpdateCourseDocumentDto } from "src/dto/UpdateCourseDocumentDto"

export interface UpdateCourseDocumentRequest {
    data: UpdateCourseDocumentDto;
    userId: string
}