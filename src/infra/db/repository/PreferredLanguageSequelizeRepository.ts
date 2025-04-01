import { Injectable, Inject } from '@nestjs/common';
import { PreferredLanguageRepository } from 'src/business/repository/PreferredLanguageRepository';
import { PreferredLanguageDbConnector } from '../connectors/PreferredLanguageDbConnector';
import { PreferredLanguageModel } from '../models/PreferredLanguageModel';

@Injectable()
export class PreferredLanguageSequelizeRepository
  implements PreferredLanguageRepository
{
  constructor(
    @Inject(PreferredLanguageDbConnector)
    private preferredLanguageDbConnector: PreferredLanguageDbConnector,
  ) {}

  public async create(
    model: PreferredLanguageModel,
  ): Promise<PreferredLanguageModel> {
    return await this.preferredLanguageDbConnector.create(model);
  }

  public async update(
    model: PreferredLanguageModel,
  ): Promise<PreferredLanguageModel> {
    return await this.preferredLanguageDbConnector.update(model);
  }
}
