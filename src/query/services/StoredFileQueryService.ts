import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { StoredFileModel } from 'src/infra/db/models/StoredFileModel';

@Injectable()
export class StoredFileQueryService {
  public async findByDocumentId(documentId: string) {
    try {
      return await StoredFileModel.findOne({ where: { documentId } });
    } catch (error) {
      throw new QueryError(
        'Failed to find stored file by document id',
      ).InnerError(error);
    }
  }

  public async findById(id: string) {
    try {
      return await StoredFileModel.findOne({ where: { id } });
    } catch (error) {
      throw new QueryError('Failed to find stored file info by id').InnerError(
        error,
      );
    }
  }
}
