import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { PerformanceTrackingModel } from 'src/infra/db/models/PerformanceTrackingModel';

@Injectable()
export class PerformanceTrackingQueryService {
  constructor() {}

  public async findByStartAndEndDate(startDate: Date, endDate: Date, userId: string, documentId: string) {
    try {
      return await PerformanceTrackingModel.findOne({
        where: {
          startDate,
          endDate,
          userId,
          documentId
        },
      });
    } catch (error) {
      throw new QueryError(
        'Failed to find performance tracking by start and end date',
      ).InnerError(error);
    }
  }
}
