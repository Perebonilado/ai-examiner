import { DocumentTopicModel } from 'src/infra/db/models/DocumentTopicModel';

export interface CreateDocumentTopicResponse {
  data: DocumentTopicModel[];
}
