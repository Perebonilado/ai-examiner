import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { CallCreditsModel } from 'src/infra/db/models/CallCreditsModel';

@Injectable()
export class CallCreditsQueryService {
  public async findByUserId(userId: string) {
    try {
      return await CallCreditsModel.findOne({ where: { userId } });
    } catch (error) {
      throw new QueryError(
        'Failed to find user call credits information',
      ).InnerError(error);
    }
  }
}
