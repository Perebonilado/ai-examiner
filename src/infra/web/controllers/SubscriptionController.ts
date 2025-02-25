import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { InitiateSubscriptionDto } from 'src/dto/InitiateSubscriptionDto';
import { UpdateSubscriptionPaymentCardDto } from 'src/dto/UpdateSubscriptionPaymentCardDto';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { CreateSubscriptionModel } from 'src/integrations/paystack/models/CreateSubscriptionModel';
import { DisableSubscriptionPayloadModel } from 'src/integrations/paystack/models/DisableSubscriptionModel';
import { EnableSubscriptionPayloadModel } from 'src/integrations/paystack/models/EnableSubscriptionModel';
import { PlanModel } from 'src/integrations/paystack/models/ListPlansModel';
import { PaystackPlansService } from 'src/integrations/paystack/services/PaystackPlansService';
import { PaystackSubscriptionService } from 'src/integrations/paystack/services/PaystackSubscriptionService';
import { OneTimeSubscriptionQueryService } from 'src/query/services/OneTimeSubscriptionQueryService';
import { SubscriptionQueryService } from 'src/query/services/SubscriptionQueryService';
import * as moment from 'moment';
import { UpdateOneTimeSubscriptionHandler } from 'src/business/handlers/OneTimeSubscription/UpdateOneTimeSubscriptionHandler';

@Controller('subscription')
export class SubscriptionController {
  constructor(
    @Inject(PaystackSubscriptionService)
    private paystackSubscriptionService: PaystackSubscriptionService,
    @Inject(SubscriptionQueryService)
    private subscriptionQueryService: SubscriptionQueryService,
    @Inject(OneTimeSubscriptionQueryService)
    private oneTimeSubscriptionService: OneTimeSubscriptionQueryService,
    @Inject(PaystackPlansService)
    private paystackPlanService: PaystackPlansService,
    @Inject(UpdateOneTimeSubscriptionHandler)
    private updateOneTimeSubscriptionHandler: UpdateOneTimeSubscriptionHandler,
    @Inject(OneTimeSubscriptionQueryService)
    private oneTimeSubscriptionQueryService: OneTimeSubscriptionQueryService,
  ) {}

  @UseGuards(AuthGuard)
  @Post('/initiate')
  public async initiateSubscription(
    @Req() request: Request,
    @Body() body: InitiateSubscriptionDto,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      let subscriptionProcessingInfo: CreateSubscriptionModel;

      const planDetails = (
        await this.paystackPlanService.getPlans({ page: 1, perPage: 50 })
      ).find((pl) => pl.planId === body.planId);

      if (!planDetails) {
        throw new HttpException('Plan does not exist', HttpStatus.BAD_REQUEST);
      }

      const recurringSubscriptionDetails =
        await this.subscriptionQueryService.findByUserId(userToken.sub);

      const oneTimeSubscriptionDetails =
        await this.oneTimeSubscriptionService.findByUserId(userToken.sub);

      // user has never subscribed to a plan
      if (!recurringSubscriptionDetails && !oneTimeSubscriptionDetails) {
        subscriptionProcessingInfo =
          await this.getSubscriptionProcessingInfoBasedOnType({
            email: userToken.email,
            isOneTimeSubscription: body.oneTimeSubscription,
            planDetails: planDetails,
            planId: body.planId,
          });
      } else {
        // user either has one time subscription or recurring subscription

        const activeSubscriptionStatuses = ['active', 'attention'];

        const userHasActiveOneTimeSubscription = !oneTimeSubscriptionDetails
          ? false
          : moment(oneTimeSubscriptionDetails?.expiresOn).isAfter(
              moment(),
              'day',
            );

        const subscriptionStatus = !recurringSubscriptionDetails?.subscriptionCode ? null : (
          await this.paystackSubscriptionService.fetchSubscriptionBySubscriptionCode(
            recurringSubscriptionDetails?.subscriptionCode,
          )
        ).subscrptionInformation.status;

        const userHasActiveRecurringSubscription = !recurringSubscriptionDetails
          ? false
          : activeSubscriptionStatuses.includes(subscriptionStatus?.toLowerCase());

        if (userHasActiveOneTimeSubscription) {
          throw new HttpException(
            `Please cancel your one time subscription before subscribing to a new plan`,
            HttpStatus.BAD_REQUEST,
          );
        } else if (userHasActiveRecurringSubscription) {
          throw new HttpException(
            `Please cancel your recurring subscription before subscribing to a new plan`,
            HttpStatus.BAD_REQUEST,
          );
        } else {
          subscriptionProcessingInfo =
            await this.getSubscriptionProcessingInfoBasedOnType({
              email: userToken.email,
              isOneTimeSubscription: body.oneTimeSubscription,
              planDetails: planDetails,
              planId: body.planId,
            });
        }
      }

      return {
        data: subscriptionProcessingInfo,
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HttpException(
        error?.response ??
          'An Error occured while trying to create a subscription',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('/cancel')
  public async cancelSubscription(
    @Body() payload: DisableSubscriptionPayloadModel,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;

      if (payload.emailToken && payload.subscriptionCode) {
        // subscription is recurring
        return await this.paystackSubscriptionService.disableSubscription(
          payload,
        );
      } else {
        // subscription is one time

        const yesterday = moment(new Date()).utc().subtract(1, 'day').toDate();
        const existinSubscription =
          await this.oneTimeSubscriptionQueryService.findByUserId(
            userToken.sub,
          );

        if (!existinSubscription) {
          throw new HttpException(
            'You do not have an active one time subscription',
            HttpStatus.BAD_REQUEST,
          );
        }

        const isSubscriptionInactive = moment(
          existinSubscription.expiresOn,
        ).isBefore(moment(), 'day');

        if (isSubscriptionInactive) {
          throw new HttpException(
            'You do not have an active one time subscription',
            HttpStatus.BAD_REQUEST,
          );
        }

        await this.updateOneTimeSubscriptionHandler.handle({
          expiresOn: yesterday,
          planCode: existinSubscription.planCode,
          userId: existinSubscription.userId,
          id: existinSubscription.id,
        });

        return {
          status: true,
        };
      }
    } catch (error) {
      throw new HttpException(
        error?.response ??
          'An Error occured while trying to cancel your subscription',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('/restart')
  public async restartSubscription(
    @Body() payload: EnableSubscriptionPayloadModel,
  ) {
    try {
      return await this.paystackSubscriptionService.enableSubscription(payload);
    } catch (error) {
      throw new HttpException(
        error?.response ??
          'An Error occured while trying to restart your subscription',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Get('/details')
  public async getSubscriptionDetails(@Req() request: Request) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const subscriptionMode = await this.getActiveSubscriptionMode(
        userToken.sub,
      );

      if (subscriptionMode.mode === 'one_time') {
        const planDetails = (
          await this.paystackPlanService.getPlans({ page: 1, perPage: 50 })
        ).find((p) => p.planId === subscriptionMode.planCode);

        return {
          cardInformation: {
            accountName: null,
            bank: null,
            brand: null,
            expirationMonth: null,
            expirationYear: null,
            last4: null,
          },
          planInformation: {
            amount: planDetails.amount,
            currency: planDetails.currency,
            name: planDetails.planName,
            planCode: planDetails.planId,
            interval: planDetails.interval
          },
          subscrptionInformation: {
            code: null,
            token: null,
            status: 'active',
          },
          mode: subscriptionMode.mode,
        };
      } else {
        const recurringSubscriptionDetails =
          await this.subscriptionQueryService.findByUserId(userToken.sub);

        if (recurringSubscriptionDetails) {
          const subscriptionInformation =
            await this.paystackSubscriptionService.fetchSubscriptionBySubscriptionCode(
              recurringSubscriptionDetails.subscriptionCode,
            );

          return {
            ...subscriptionInformation,
            mode: subscriptionMode.mode,
          };
        } else {
          return {
            cardInformation: {
              accountName: null,
              bank: null,
              brand: null,
              expirationMonth: null,
              expirationYear: null,
              last4: null,
            },
            planInformation: {
              amount: null,
              currency: null,
              name: 'Free',
              planCode: null,
              interval: "monthly"
            },
            subscrptionInformation: {
              code: null,
              token: null,
              status: null,
            },
            mode: null,
          };
        }
      }
    } catch (error) {
      throw new HttpException(
        error?.response ??
          'An Error occured while trying to get your subscription information',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('/update-card-information')
  public async updateCardInfo(@Body() body: UpdateSubscriptionPaymentCardDto) {
    try {
      return await this.paystackSubscriptionService.getUpdateCardLink(
        body.subscriptionCode,
      );
    } catch (error) {
      throw new HttpException(
        error?.response ??
          'An Error occured while trying to create a subscription',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async getActiveSubscriptionMode(userId: string) {
    try {
      const oneTimeSubscriptionDetails =
        await this.oneTimeSubscriptionService.findByUserId(userId);

      if (
        oneTimeSubscriptionDetails &&
        moment(oneTimeSubscriptionDetails?.expiresOn).isAfter(moment(), 'day')
      ) {
        return {
          mode: 'one_time',
          planCode: oneTimeSubscriptionDetails.planCode,
        };
      } else {
        return {
          mode: 'recurring',
        };
      }
    } catch (error) {
      throw new HttpException(
        'Failed to get active subscription mode',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async getSubscriptionProcessingInfoBasedOnType({
    email,
    isOneTimeSubscription,
    planId,
    planDetails,
  }: {
    email: string;
    planId: string;
    isOneTimeSubscription: boolean;
    planDetails: PlanModel;
  }) {
    if (isOneTimeSubscription) {
      return await this.paystackSubscriptionService.createOneTimeSubscription({
        amount: `${planDetails.amount.toString()}00`,
        currency: planDetails.currency,
        email: email,
        planCode: planId,
      });
    } else {
      return await this.paystackSubscriptionService.createRecurringSubscription(
        {
          email: email,
          plan: planId,
        },
      );
    }
  }
}
