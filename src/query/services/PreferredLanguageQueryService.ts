import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { PreferredLanguageModel } from 'src/infra/db/models/PreferredLanguageModel';

@Injectable()
export class PreferredLanguageQueryService {
  public async findByUserId(userId: string) {
    try {
      return await PreferredLanguageModel.findOne({ where: { userId } });
    } catch (error) {
      throw new QueryError('Failed to find preferred language').InnerError(
        error,
      );
    }
  }
}
