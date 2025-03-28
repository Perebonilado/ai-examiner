import { FlaggedDocumentMessageModel } from 'src/infra/db/models/FlaggedDocumentMessageModel';

export const FlaggedDocumentMessageRepository = Symbol(
  'FlaggedDocumentMessageRepository',
);

export interface FlaggedDocumentMessageRepository {
  create(
    model: FlaggedDocumentMessageModel,
  ): Promise<FlaggedDocumentMessageModel>;
}
