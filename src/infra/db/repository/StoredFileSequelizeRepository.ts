import { Inject, Injectable } from '@nestjs/common';
import { StoredFileRepository } from 'src/business/repository/StoredFileRepository';
import { StoredFileDbConnector } from '../connectors/StoredFileDbConnector';
import { StoredFileModel } from '../models/StoredFileModel';

@Injectable()
export class StoredFileSequelizeRepository implements StoredFileRepository {
  constructor(
    @Inject(StoredFileDbConnector)
    private storedFileDbConnector: StoredFileDbConnector,
  ) {}

  public async create(model: StoredFileModel): Promise<StoredFileModel> {
    return await this.storedFileDbConnector.create(model);
  }

  public async update(model: StoredFileModel): Promise<StoredFileModel> {
    return await this.storedFileDbConnector.update(model);
  }
}
