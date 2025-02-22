import { Injectable } from '@nestjs/common';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';
import { PerformanceTrackingModel } from '../models/PerformanceTrackingModel';

@Injectable()
export class PerformanceTrackingDbConnector {
  public async create(performance: PerformanceTrackingModel) {
    try {
      return await PerformanceTrackingModel.create(performance);
    } catch (error) {
      throw new DatabaseError('Failed to save performance').InnerError(error);
    }
  }

  public async deleteUserPerformanceTrackingData(userId: string) {
    try {
      return await PerformanceTrackingModel.destroy({ where: { userId } });
    } catch (error) {
      throw new DatabaseError(
        'Failed to delete user performance tracking data',
      ).InnerError(error);
    }
  }
}
