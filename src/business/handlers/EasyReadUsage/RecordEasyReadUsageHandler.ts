import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { RecordEasyReadUsageRequest } from '../request/RecordEasyReadUsageRequest';
import { RecordEasyReadUsageResponse } from '../response/RecordEasyReadUsageResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { EasyReadUsageRepository } from 'src/business/repository/EasyReadUsageRepository';
import { EasyReadUsageQueryService } from 'src/query/services/EasyReadUsageQueryService';
import { maxEasyReadSecondsPerReport } from 'src/constants';
import { chargeableEasyReadSeconds } from './chargeableEasyReadSeconds';

@Injectable()
export class RecordEasyReadUsageHandler extends AbstractRequestHandlerTemplate<
  RecordEasyReadUsageRequest,
  RecordEasyReadUsageResponse
> {
  constructor(
    @Inject(EasyReadUsageQueryService)
    private easyReadUsageQueryService: EasyReadUsageQueryService,
    @Inject(EasyReadUsageRepository)
    private easyReadUsageRepository: EasyReadUsageRepository,
  ) {
    super();
  }

  protected async handleRequest(
    request: RecordEasyReadUsageRequest,
  ): Promise<CommandResponse<RecordEasyReadUsageResponse>> {
    try {
      const { userId, month, seconds, now } = request;

      let usage = await this.easyReadUsageQueryService.findByUserIdAndMonth(
        userId,
        month,
      );

      if (!usage) {
        try {
          usage = await this.easyReadUsageRepository.create({
            userId,
            month,
            secondsUsed: 0,
            lastActiveOn: null,
          });
        } catch (error) {
          // Another request created this month's row first (unique user + month).
          usage = await this.easyReadUsageQueryService.findByUserIdAndMonth(
            userId,
            month,
          );
          if (!usage) throw error;
        }
      }

      const charge = chargeableEasyReadSeconds(
        seconds,
        usage.lastActiveOn,
        now,
        maxEasyReadSecondsPerReport,
      );
      if (charge > 0) {
        await this.easyReadUsageRepository.addSeconds(usage.id, charge, now);
      }

      return {
        data: { secondsUsed: (usage.secondsUsed ?? 0) + charge },
        message: 'Easy read usage recorded',
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HandlerError('Failed to record easy read usage').InnerError(
        error,
      );
    }
  }
}
