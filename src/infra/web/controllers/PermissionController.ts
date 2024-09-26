import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { PaystackSubscriptionService } from 'src/integrations/paystack/services/PaystackSubscriptionService';
import { OneTimeSubscriptionQueryService } from 'src/query/services/OneTimeSubscriptionQueryService';
import { PermissionQueryService } from 'src/query/services/PermissionQueryService';
import { PlanPermissionQueryService } from 'src/query/services/PlanPermissionQueryService';
import { QuestionQueryService } from 'src/query/services/QuestionQueryService';
import { SubscriptionQueryService } from 'src/query/services/SubscriptionQueryService';
import * as moment from 'moment';
import { inactiveSubscriptionStatuses } from 'src/constants';

@Controller('permission')
export class PermissionController {
  constructor(
    @Inject(PaystackSubscriptionService)
    private paystackSubscriptionService: PaystackSubscriptionService,
    @Inject(SubscriptionQueryService)
    private subscriptionQueryService: SubscriptionQueryService,
    @Inject(PlanPermissionQueryService)
    private planPermissionQueryService: PlanPermissionQueryService,
    @Inject(PermissionQueryService)
    private permissionQueryService: PermissionQueryService,
    @Inject(QuestionQueryService)
    private questionQueryService: QuestionQueryService,
    @Inject(OneTimeSubscriptionQueryService)
    private oneTimeSubscriptionService: OneTimeSubscriptionQueryService,
  ) {}

  @UseGuards(AuthGuard)
  @Get('')
  public async getUserPermissions(@Req() request: Request) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;

      const recurringSubscriptionDetails =
        await this.subscriptionQueryService.findByUserId(userToken.sub);

      const oneTimeSubscriptionDetails =
        await this.oneTimeSubscriptionService.findByUserId(userToken.sub);

      const maxNumberOfQuestionGenerationForFreePlanTier = 1;
   

      // user might have a recurring or one time subscription
      if (recurringSubscriptionDetails || oneTimeSubscriptionDetails) {
        //active one time sub
        const userHasActiveOneTimeSubscription = moment(
          oneTimeSubscriptionDetails?.expiresOn,
        ).isAfter(moment(), 'day');

        const userRecurringSubscriptionStatus = (
          await this.paystackSubscriptionService.fetchSubscriptionBySubscriptionCode(
            recurringSubscriptionDetails?.subscriptionCode,
          )
        ).subscrptionInformation.status;

        // active recurring sub
        const userHasActiveRecurringSubscription =
          !inactiveSubscriptionStatuses.includes(
            userRecurringSubscriptionStatus,
          );

        if (
          userHasActiveOneTimeSubscription ||
          userHasActiveRecurringSubscription
        ) {
          let planCodeToUse: string;

          if (userHasActiveOneTimeSubscription) {
            planCodeToUse = oneTimeSubscriptionDetails.planCode;
          } else {
            const subscriptionDetails = await this.paystackSubscriptionService.fetchSubscriptionBySubscriptionCode(recurringSubscriptionDetails.subscriptionCode)
            
            planCodeToUse = subscriptionDetails.planInformation.planCode;
          }

          const planPermission =
            await this.planPermissionQueryService.findPlanPermissionByPlanId(
              planCodeToUse,
            );

          const permission =
            await this.permissionQueryService.findPermissionById(
              planPermission.permissionId,
            );

          const modifiedPermissions = permission.permissions
            ? (permission.permissions as any)
            : {};
          modifiedPermissions.maxGenerationReached = false;

          permission.permissions = modifiedPermissions;

          return permission.permissions;
        } else {
          // return free plan permissions
          const permission =
            await this.permissionQueryService.findPermissionByPlanType('free');

          const numberOfQuestionsGeneratedForCurrentMonth =
            await this.questionQueryService.getUserQuestionsCountForCurrentMonth(
              userToken.sub,
            );

          const modifiedPermissions = permission.permissions
            ? (permission.permissions as any)
            : {};

          modifiedPermissions.maxGenerationReached =
            numberOfQuestionsGeneratedForCurrentMonth >=
            maxNumberOfQuestionGenerationForFreePlanTier
              ? true
              : false;

          permission.permissions = modifiedPermissions;

          return permission.permissions;
        }
      } else {
        // return free plan permissions
        const permission =
          await this.permissionQueryService.findPermissionByPlanType('free');

        const modifiedPermissions = permission.permissions
          ? (permission.permissions as any)
          : {};

        const numberOfQuestionsGeneratedForCurrentMonth =
          await this.questionQueryService.getUserQuestionsCountForCurrentMonth(
            userToken.sub,
          );

        modifiedPermissions.maxGenerationReached =
          numberOfQuestionsGeneratedForCurrentMonth >=
          maxNumberOfQuestionGenerationForFreePlanTier
            ? true
            : false;

        permission.permissions = modifiedPermissions;

        return permission.permissions;
      }
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to get user permissions',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
