import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { FlaggedDocumentMessageModel } from 'src/infra/db/models/FlaggedDocumentMessageModel';

@Injectable()
export class FlaggedDocumentMessageQueryService {
  public async findFlaggedDocumentMessagesByDocumentMessageId(
    documentMessageId: string,
  ) {
    try {
      return await FlaggedDocumentMessageModel.findAll({
        where: { documentMessageId },
      });
    } catch (error) {
      throw new QueryError('Failed to find flagged messages').InnerError(error);
    }
  }
}
