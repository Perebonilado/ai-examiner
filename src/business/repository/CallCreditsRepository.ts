import { CallCreditsModel } from 'src/infra/db/models/CallCreditsModel';

export const CallCreditsRepository = Symbol('CallCreditsRepository');

export interface CallCreditsRepository {
  create(callCredits: CallCreditsModel): Promise<CallCreditsModel>;
  update(callCredits: CallCreditsModel): Promise<void>;
}
