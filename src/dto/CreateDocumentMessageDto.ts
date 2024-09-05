import { MessageReponseType } from "src/infra/web/models/MessageResponseTypeModel";

export interface CreateDocumentMessageDto {
  message: string;
  courseDocumentId: string;
  userId: string;
  responseFormat: MessageReponseType
}
