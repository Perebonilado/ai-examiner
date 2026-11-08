import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { EasyReadUsageModel } from 'src/infra/db/models/EasyReadUsageModel';

@Injectable()
export class EasyReadUsageQueryService {
  public async findByUserIdAndMonth(userId: string, month: string) {
    try {
      return await EasyReadUsageModel.findOne({ where: { userId, month } });
    } catch (error) {
      throw new QueryError('Failed to find easy read usage').InnerError(error);
    }
  }
}
