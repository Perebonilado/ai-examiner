import { MessageSenderModel } from "src/infra/web/models/MessageSenderModel";

export interface CreateDocumentMessageDto {
    message: string;
    sender: MessageSenderModel;
    courseDocumentId: string;
}