import { HttpService } from '@nestjs/axios';
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import {
  CreateOneTimeSubscriptionPayloadModel,
  CreateSubscriptionModel,
  CreateSubscriptionPayloadModel,
} from '../models/CreateSubscriptionModel';
import { AxiosResponse } from 'axios';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { CreateSubscriptionDto } from '../dto/CreateSubscriptionDto';
import { UpdateCardModel } from '../models/UpdateCardModel';
import { UpdateCardDto } from '../dto/UpdateCardDto';
import { GetSubscriptionModel } from '../models/GetSubscriptionModel';
import {
  DisableSubscriptionModel,
  DisableSubscriptionPayloadModel,
} from '../models/DisableSubscriptionModel';
import { DisableSubscriptionDto } from '../dto/DisableSubscriptionDto';
import {
  EnableSubscriptionModel,
  EnableSubscriptionPayloadModel,
} from '../models/EnableSubscriptionModel';
import {
  FetchSubscriptionDto,
  ListSubscriptionDto,
} from '../dto/ListSubscriptionDto';
import { ListSubscriptionsPayloadModel } from '../models/ListSubscriptionModel';
import { convertSmallerDemoninationtoLarger } from 'src/utils';

@Injectable()
export class PaystackSubscriptionService {
  constructor(private httpService: HttpService) {}

  private baseUrl = 'https://api.paystack.co';

  public async createRecurringSubscription(
    payload: CreateSubscriptionPayloadModel,
  ): Promise<CreateSubscriptionModel> {
    /*
    The amount is just a placeholder.
    It will be overriden by the amount of the plan
    */
    const body = {
      email: payload.email,
      amount: '50',
      plan: payload.plan,
      metadata: {
        cancel_action: `${EnvironmentVariables.config.frontendBaseUrl}/pricing`,
        purchase_type: 'subscription'
      },
    } as Record<string, any>;

    if (payload.startDate) {
      body.start_date = payload.startDate;
    }

    try {
      const { data } = await this.httpService.axiosRef.post<
        any,
        AxiosResponse<CreateSubscriptionDto>
      >(
        `${this.baseUrl}/transaction/initialize`,
        {
          ...body,
        },
        {
          headers: {
            Authorization: `Bearer ${EnvironmentVariables.config.paystackSecretKey}`,
          },
        },
      );

      return {
        accessCode: data.data.access_code,
        redirectUrl: data.data.authorization_url,
        reference: data.data.reference,
      };
    } catch (error) {
      throw new HttpException(
        'An error occured while trying to create your subscription',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  public async createOneTimeSubscription(
    payload: CreateOneTimeSubscriptionPayloadModel,
  ): Promise<CreateSubscriptionModel> {
    try {
      const { planCode, amount, currency, email } = payload;

      const { data } = await this.httpService.axiosRef.post<
        any,
        AxiosResponse<CreateSubscriptionDto>
      >(
        `${this.baseUrl}/transaction/initialize`,
        {
          amount,
          email,
          currency,
          channels: ['bank_transfer', 'bank', 'ussd'],
          metadata: {
            plan_code: planCode,
            purchase_type: 'subscription',
            cancel_action: `${EnvironmentVariables.config.frontendBaseUrl}/pricing`,
          },
          callback_url: `${EnvironmentVariables.config.frontendBaseUrl}/new-document`,
        },
        {
          headers: {
            Authorization: `Bearer ${EnvironmentVariables.config.paystackSecretKey}`,
          },
        },
      );

      return {
        accessCode: data.data.access_code,
        redirectUrl: data.data.authorization_url,
        reference: data.data.reference,
      };
    } catch (error) {
      throw new HttpException(
        'An error occured while trying to create your one time subscription',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  public async getUpdateCardLink(
    subscriptionCode: string,
  ): Promise<UpdateCardModel> {
    try {
      const { data } = await this.httpService.axiosRef.get<
        any,
        AxiosResponse<UpdateCardDto>
      >(`${this.baseUrl}/subscription/${subscriptionCode}/manage/link`, {
        headers: {
          Authorization: `Bearer ${EnvironmentVariables.config.paystackSecretKey}`,
        },
      });

      return {
        link: data.data.link,
      };
    } catch (error) {
      throw new HttpException(
        'An error occured while trying to get card update link.',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  public async getActiveSubscriptions({
    customer,
    page = 1,
    perPage = 10,
    plan = '',
  }: ListSubscriptionsPayloadModel): Promise<GetSubscriptionModel[]> {
    try {
      const { data } = await this.httpService.axiosRef.get<
        any,
        AxiosResponse<ListSubscriptionDto>
      >(`${this.baseUrl}/subscription`, {
        headers: {
          Authorization: `Bearer ${EnvironmentVariables.config.paystackSecretKey}`,
        },
        params: {
          customer,
          page,
          perPage,
          plan,
        },
      });

      return data.data
        .filter((sub) => sub.status.toLowerCase() === 'active')
        .map((subscription) => ({
          cardInformation: {
            accountName: subscription.authorization.account_name,
            bank: subscription.authorization.bank,
            brand: subscription.authorization.brand,
            expirationMonth: subscription.authorization.exp_month,
            expirationYear: subscription.authorization.exp_year,
            last4: subscription.authorization.last4,
          },
          planInformation: {
            amount: subscription.plan.amount,
            currency: subscription.plan.currency,
            name: subscription.plan.name,
            planCode: subscription.plan.plan_code,
            interval: subscription.plan.interval,
            description: JSON.parse(subscription.plan.description)
          },
          subscrptionInformation: {
            code: subscription.subscription_code,
            token: subscription.email_token,
            status: subscription.status,
          },
        }));
    } catch (error) {
      throw new HttpException(
        'An error occured while trying to get subscription information',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  public async fetchSubscriptionBySubscriptionCode(
    subscriptionCode: string,
  ): Promise<GetSubscriptionModel> {
    try {
      const {
        data: { data: subscription },
      } = await this.httpService.axiosRef.get<
        any,
        AxiosResponse<FetchSubscriptionDto>
      >(`${this.baseUrl}/subscription/${subscriptionCode}`, {
        headers: {
          Authorization: `Bearer ${EnvironmentVariables.config.paystackSecretKey}`,
        },
      });

      if (!subscription) {
        return null;
      }

      return {
        cardInformation: {
          accountName: subscription.authorization.account_name,
          bank: subscription.authorization.bank,
          brand: subscription.authorization.brand,
          expirationMonth: subscription.authorization.exp_month,
          expirationYear: subscription.authorization.exp_year,
          last4: subscription.authorization.last4,
        },
        planInformation: {
          amount: convertSmallerDemoninationtoLarger(
            subscription.plan.amount,
            100,
          ),
          currency: subscription.plan.currency,
          name: subscription.plan.name,
          planCode: subscription.plan.plan_code,
          interval: subscription.plan.interval,
          description: JSON.parse(subscription.plan.description)
        },
        subscrptionInformation: {
          code: subscription.subscription_code,
          token: subscription.email_token,
          status: subscription.status,
        },
      };
    } catch (error) {
      throw new HttpException(
        `An error occured while trying to get subscription information using subscription code ${subscriptionCode}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  public async disableSubscription(
    payload: DisableSubscriptionPayloadModel,
  ): Promise<DisableSubscriptionModel> {
    try {
      const { data } = await this.httpService.axiosRef.post<
        any,
        AxiosResponse<DisableSubscriptionDto>
      >(
        `${this.baseUrl}/subscription/disable`,
        {
          code: payload.subscriptionCode,
          token: payload.emailToken,
        },
        {
          headers: {
            Authorization: `Bearer ${EnvironmentVariables.config.paystackSecretKey}`,
          },
        },
      );

      return {
        status: data.status,
      };
    } catch (error) {
      throw new HttpException(
        'An error occured while trying to disable your subscription',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  public async enableSubscription(
    payload: EnableSubscriptionPayloadModel,
  ): Promise<EnableSubscriptionModel> {
    try {
      const { data } = await this.httpService.axiosRef.post<
        any,
        AxiosResponse<DisableSubscriptionDto>
      >(
        `${this.baseUrl}/subscription/enable`,
        {
          code: payload.subscriptionCode,
          token: payload.emailToken,
        },
        {
          headers: {
            Authorization: `Bearer ${EnvironmentVariables.config.paystackSecretKey}`,
          },
        },
      );

      return {
        status: data.status,
      };
    } catch (error) {
      throw new HttpException(
        'An error occured while trying to enable your subscription',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
