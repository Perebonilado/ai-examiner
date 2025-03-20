import { Injectable } from '@nestjs/common';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';
import { CallCreditsModel } from '../models/CallCreditsModel';

@Injectable()
export class CallCreditsDbConnector {
  constructor() {}

  public async create(cc: CallCreditsModel) {
    try {
      return await CallCreditsModel.create(cc);
    } catch (error) {
      throw new DatabaseError('Failed to create call credits data').InnerError(
        error,
      );
    }
  }

  public async update(cc: CallCreditsModel) {
    try {
      await CallCreditsModel.update(cc, {
        where: { id: cc.id },
        fields: ['remainingTimeMs', 'totalTimePurchasedMs'],
      });
    } catch (error) {
      throw new DatabaseError('Failed to update call credits');
    }
  }
}
