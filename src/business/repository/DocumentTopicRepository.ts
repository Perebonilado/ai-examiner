import { DocumentTopicModel } from 'src/infra/db/models/DocumentTopicModel';

export const DocumentTopicRepository = Symbol('DocumentTopicRepository');

export interface DocumentTopicRepository {
  bulkCreate(topics: DocumentTopicModel[]): Promise<DocumentTopicModel[]>;
  delete(topic: DocumentTopicModel): Promise<void>;
}
