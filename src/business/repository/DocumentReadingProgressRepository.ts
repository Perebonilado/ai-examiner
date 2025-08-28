import { DocumentReadingProgressModel } from 'src/infra/db/models/DocumentReadingProgress';

export const documentReadingProgressRepository = Symbol(
  'DOCUMENT_READING_PROGRESS_REPOSITORY',
);

export interface DocumentReadingProgressRepository {
  create(
    model: DocumentReadingProgressModel,
  ): Promise<DocumentReadingProgressModel>;
  bulkCreate(
    models: DocumentReadingProgressModel[],
  ): Promise<DocumentReadingProgressModel[]>;
  bulkDelete(topicIds: number[]): Promise<void>;
  delete(id: number): Promise<void>;
}
