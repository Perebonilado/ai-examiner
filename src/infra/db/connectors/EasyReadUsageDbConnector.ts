import { Injectable } from '@nestjs/common';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';
import { EasyReadUsageModel } from '../models/EasyReadUsageModel';

@Injectable()
export class EasyReadUsageDbConnector {
  public async create(usage: Partial<EasyReadUsageModel>) {
    try {
      return await EasyReadUsageModel.create(usage as EasyReadUsageModel);
    } catch (error) {
      throw new DatabaseError('Failed to create easy read usage').InnerError(
        error,
      );
    }
  }

  public async addSeconds(id: string, seconds: number, lastActiveOn: Date) {
    try {
      await EasyReadUsageModel.increment('secondsUsed', {
        by: seconds,
        where: { id },
      });
      await EasyReadUsageModel.update({ lastActiveOn } as EasyReadUsageModel, {
        where: { id },
        fields: ['lastActiveOn'],
      });
    } catch (error) {
      throw new DatabaseError('Failed to update easy read usage').InnerError(
        error,
      );
    }
  }
}
