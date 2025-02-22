import { Inject, Injectable } from '@nestjs/common';
import { PerformanceTrackingRepository } from 'src/business/repository/PerformanceTrackingRepository';
import { PerformanceTrackingDbConnector } from '../connectors/PerformanceTrackingDbConnector';
import { PerformanceTrackingModel } from '../models/PerformanceTrackingModel';
import RepositoryError from 'src/error-handlers/infra/RepositoryError';

@Injectable()
export class PerformanceTrackingSequelizeRepository
  implements PerformanceTrackingRepository
{
  constructor(
    @Inject(PerformanceTrackingDbConnector)
    private performanceTrackingDbConnector: PerformanceTrackingDbConnector,
  ) {}

  public async create(performance: PerformanceTrackingModel) {
    try {
      return await this.performanceTrackingDbConnector.create(performance);
    } catch (error) {
      throw new RepositoryError(
        'Failed to create performance tracking',
      ).InnerError(error);
    }
  }

  public async deleteUserPerformanceTrackingData(userId: string) {
    return await this.performanceTrackingDbConnector.deleteUserPerformanceTrackingData(
      userId,
    );
  }
}
