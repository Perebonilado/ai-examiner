import { DocumentMessageModel } from 'src/infra/db/models/DocumentMessageModel';

export const DocumentMessageRepository = Symbol('DocumentMessageRepository');

export interface DocumentMessageRepository {
  create(documentMessage: DocumentMessageModel): Promise<DocumentMessageModel>;
}
