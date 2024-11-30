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
}
