import { DocumentSummaryModel } from 'src/infra/db/models/DocumentSummaryModel';

export const DocumentSummaryRepository = Symbol('DocumentSummaryRepository');

export interface DocumentSummaryRepository {
  create(model: DocumentSummaryModel): Promise<DocumentSummaryModel>;
}
