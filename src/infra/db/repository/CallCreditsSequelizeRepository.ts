import { Inject, Injectable } from '@nestjs/common';
import { CallCreditsDbConnector } from '../connectors/CallCreditsDbConnector';
import { CallCreditsModel } from '../models/CallCreditsModel';
import { CallCreditsRepository } from 'src/business/repository/CallCreditsRepository';

@Injectable()
export class CallCreditsSequelizeRepository implements CallCreditsRepository {
  constructor(
    @Inject(CallCreditsDbConnector)
    private callCreditsDbConnector: CallCreditsDbConnector,
  ) {}

  public async create(callCredits: CallCreditsModel) {
    return await this.callCreditsDbConnector.create(callCredits);
  }

  public async update(callCredits: CallCreditsModel) {
    return await this.callCreditsDbConnector.update(callCredits);
  }
}
