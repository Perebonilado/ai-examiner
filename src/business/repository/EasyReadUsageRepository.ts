import { EasyReadUsageModel } from 'src/infra/db/models/EasyReadUsageModel';

export const EasyReadUsageRepository = Symbol('EasyReadUsageRepository');

export interface EasyReadUsageRepository {
  create(usage: Partial<EasyReadUsageModel>): Promise<EasyReadUsageModel>;
  /** Adds seconds atomically, so overlapping requests don't overwrite each other. */
  addSeconds(id: string, seconds: number, lastActiveOn: Date): Promise<void>;
}
