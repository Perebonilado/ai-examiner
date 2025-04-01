import { PreferredLanguageModel } from 'src/infra/db/models/PreferredLanguageModel';

export const PreferredLanguageRepository = Symbol(
  'PreferredLanguageRepository',
);

export interface PreferredLanguageRepository {
  create(model: PreferredLanguageModel): Promise<PreferredLanguageModel>;
  update(model: PreferredLanguageModel): Promise<PreferredLanguageModel>;
}
