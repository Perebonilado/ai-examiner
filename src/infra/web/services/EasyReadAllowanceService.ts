import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as moment from 'moment';
import {
  freePlanEasyReadSecondsPerMonth,
  inactiveSubscriptionStatuses,
} from 'src/constants';
import { PaystackSubscriptionService } from 'src/integrations/paystack/services/PaystackSubscriptionService';
import { SubscriptionQueryService } from 'src/query/services/SubscriptionQueryService';
import { OneTimeSubscriptionQueryService } from 'src/query/services/OneTimeSubscriptionQueryService';
import { EasyReadUsageQueryService } from 'src/query/services/EasyReadUsageQueryService';
import { RecordEasyReadUsageHandler } from 'src/business/handlers/EasyReadUsage/RecordEasyReadUsageHandler';

export const EASY_READ_LIMIT_REACHED = 'EASY_READ_LIMIT_REACHED';

export interface EasyReadAllowance {
  /** False on a paid plan: no limit. */
  limited: boolean;
  limitSeconds: number | null;
  usedSeconds: number;
  remainingSeconds: number | null;
  /** When the free minutes refill (start of next month, UTC). */
  resetsOn: string | null;
}

const PLAN_CACHE_MS = 60_000;

/**
 * Free plan: 10 minutes of Easy Read per calendar month (UTC). Paid plans: unlimited.
 * "Paid" uses the same rule as GET /permission: an unexpired one-time subscription, or a
 * recurring Paystack subscription whose status is not completed / cancelled / attention.
 */
@Injectable()
export class EasyReadAllowanceService {
  private readonly logger = new Logger(EasyReadAllowanceService.name);
  // The app reports reading time every ~15s; don't ask Paystack each time.
  private readonly paidPlanCache = new Map<
    string,
    { paid: boolean; until: number }
  >();

  constructor(
    @Inject(SubscriptionQueryService)
    private subscriptionQueryService: SubscriptionQueryService,
    @Inject(OneTimeSubscriptionQueryService)
    private oneTimeSubscriptionQueryService: OneTimeSubscriptionQueryService,
    @Inject(PaystackSubscriptionService)
    private paystackSubscriptionService: PaystackSubscriptionService,
    @Inject(EasyReadUsageQueryService)
    private easyReadUsageQueryService: EasyReadUsageQueryService,
    @Inject(RecordEasyReadUsageHandler)
    private recordEasyReadUsageHandler: RecordEasyReadUsageHandler,
  ) {}

  public static currentMonth(now: Date = new Date()) {
    return moment(now).utc().format('YYYY-MM');
  }

  private static resetsOn(now: Date = new Date()) {
    return moment(now).utc().add(1, 'month').startOf('month').toISOString();
  }

  public async hasActivePaidPlan(userId: string): Promise<boolean> {
    const cached = this.paidPlanCache.get(userId);
    if (cached && cached.until > Date.now()) return cached.paid;

    let paid = false;
    try {
      const oneTime =
        await this.oneTimeSubscriptionQueryService.findByUserId(userId);
      if (oneTime && moment(oneTime.expiresOn).isAfter(moment(), 'day')) {
        paid = true;
      } else {
        const recurring =
          await this.subscriptionQueryService.findByUserId(userId);
        if (recurring?.subscriptionCode) {
          const status = (
            await this.paystackSubscriptionService.fetchSubscriptionBySubscriptionCode(
              recurring.subscriptionCode,
            )
          ).subscrptionInformation.status;
          paid = !!status && !inactiveSubscriptionStatuses.includes(status);
        }
      }
    } catch (error) {
      // If the plan can't be checked (e.g. Paystack is down), don't lock paying users out.
      this.logger.error(`Could not check plan for ${userId}`, error?.stack);
      return true;
    }

    this.paidPlanCache.set(userId, { paid, until: Date.now() + PLAN_CACHE_MS });
    return paid;
  }

  public async getAllowance(userId: string): Promise<EasyReadAllowance> {
    if (await this.hasActivePaidPlan(userId)) {
      return {
        limited: false,
        limitSeconds: null,
        usedSeconds: 0,
        remainingSeconds: null,
        resetsOn: null,
      };
    }

    const now = new Date();
    const usage = await this.easyReadUsageQueryService.findByUserIdAndMonth(
      userId,
      EasyReadAllowanceService.currentMonth(now),
    );
    return this.freeAllowance(usage?.secondsUsed ?? 0, now);
  }

  /** Records reading time for free users and returns the updated allowance. */
  public async recordUsage(
    userId: string,
    seconds: number,
  ): Promise<EasyReadAllowance> {
    if (await this.hasActivePaidPlan(userId)) return this.getAllowance(userId);

    const now = new Date();
    const result = await this.recordEasyReadUsageHandler.handle({
      userId,
      month: EasyReadAllowanceService.currentMonth(now),
      seconds,
      now,
    });
    return this.freeAllowance(result.data.secondsUsed, now);
  }

  /** Throws 403 EASY_READ_LIMIT_REACHED when a free user has no Easy Read time left this month. */
  public async assertCanUseEasyRead(userId: string) {
    const allowance = await this.getAllowance(userId);
    if (allowance.limited && (allowance.remainingSeconds ?? 0) <= 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          code: EASY_READ_LIMIT_REACHED,
          message:
            'You have used your free Easy Read minutes for this month. Upgrade to keep reading.',
          resetsOn: allowance.resetsOn,
        },
        HttpStatus.FORBIDDEN,
      );
    }
    return allowance;
  }

  private freeAllowance(usedSeconds: number, now: Date): EasyReadAllowance {
    const used = Math.max(0, Math.round(usedSeconds));
    return {
      limited: true,
      limitSeconds: freePlanEasyReadSecondsPerMonth,
      usedSeconds: Math.min(used, freePlanEasyReadSecondsPerMonth),
      remainingSeconds: Math.max(0, freePlanEasyReadSecondsPerMonth - used),
      resetsOn: EasyReadAllowanceService.resetsOn(now),
    };
  }
}
