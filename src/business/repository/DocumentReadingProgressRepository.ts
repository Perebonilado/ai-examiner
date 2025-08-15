import { DocumentReadingProgressModel } from 'src/infra/db/models/DocumentReadingProgress';

export const DOCUMENT_READING_PROGRESS_REPOSITORY = Symbol(
  'DOCUMENT_READING_PROGRESS_REPOSITORY',
);

export interface DocumentReadingProgressRepository {
  create(
    model: DocumentReadingProgressModel,
  ): Promise<DocumentReadingProgressModel>;
  delete(id: number): Promise<void>;
}
