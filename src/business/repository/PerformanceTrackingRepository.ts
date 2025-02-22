import { PerformanceTrackingModel } from 'src/infra/db/models/PerformanceTrackingModel';

export const PerformanceTrackingRepository = Symbol(
  'PerformanceTrackingRepository',
);

export interface PerformanceTrackingRepository {
  create(
    performance: PerformanceTrackingModel,
  ): Promise<PerformanceTrackingModel>;
  deleteUserPerformanceTrackingData(userId: string): Promise<number>;
}
