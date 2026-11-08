import { Inject, Injectable } from '@nestjs/common';
import { EasyReadUsageRepository } from 'src/business/repository/EasyReadUsageRepository';
import { EasyReadUsageDbConnector } from '../connectors/EasyReadUsageDbConnector';
import { EasyReadUsageModel } from '../models/EasyReadUsageModel';

@Injectable()
export class EasyReadUsageSequelizeRepository
  implements EasyReadUsageRepository
{
  constructor(
    @Inject(EasyReadUsageDbConnector)
    private easyReadUsageDbConnector: EasyReadUsageDbConnector,
  ) {}

  public async create(usage: Partial<EasyReadUsageModel>) {
    return await this.easyReadUsageDbConnector.create(usage);
  }

  public async addSeconds(id: string, seconds: number, lastActiveOn: Date) {
    return await this.easyReadUsageDbConnector.addSeconds(
      id,
      seconds,
      lastActiveOn,
    );
  }
}
