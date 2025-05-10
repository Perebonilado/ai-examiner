import { StoredFileModel } from 'src/infra/db/models/StoredFileModel';

export const StoredFileRepository = Symbol('StoredFileRepository');

export interface StoredFileRepository {
  create(model: StoredFileModel): Promise<StoredFileModel>;
  update(model: StoredFileModel): Promise<StoredFileModel>;
}
