import { HttpService } from '@nestjs/axios';
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import {
  CreateSubscriptionModel,
  CreateSubscriptionPayloadModel,
} from '../models/CreateSubscriptionModel';
import { AxiosResponse } from 'axios';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { CreateSubscriptionDto } from '../dto/CreateSubscriptionDto';
import { UpdateCardModel } from '../models/UpdateCardModel';
import { UpdateCardDto } from '../dto/UpdateCardDto';
import { GetSubscriptionModel } from '../models/GetSubscriptionModel';
import { GetSubscriptionDto } from '../dto/GetSubscriptionDto';
import {
  DisableSubscriptionModel,
  DisableSubscriptionPayloadModel,
} from '../models/DisableSubscriptionModel';
import { DisableSubscriptionDto } from '../dto/DisableSubscriptionDto';
import {
  EnableSubscriptionModel,
  EnableSubscriptionPayloadModel,
} from '../models/EnableSubscriptionModel';

@Injectable()
export class SubscriptionService {
  constructor(private httpService: HttpService) {}

  baseUrl = 'https://api.paystack.co';

  public async createSubscription(
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
        'An error occured while trying to get card update link',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  public async getSubscription(
    subscriptionCode: string,
  ): Promise<GetSubscriptionModel> {
    try {
      const { data } = await this.httpService.axiosRef.get<
        any,
        AxiosResponse<GetSubscriptionDto>
      >(`${this.baseUrl}/subscription/${subscriptionCode}`, {
        headers: {
          Authorization: `Bearer ${EnvironmentVariables.config.paystackSecretKey}`,
        },
      });

      return {
        cardInformation: {
          accountName: data.data.authorization.account_name,
          bank: data.data.authorization.bank,
          brand: data.data.authorization.brand,
          expirationMonth: data.data.authorization.exp_month,
          expirationYear: data.data.authorization.exp_year,
          last4: data.data.authorization.last4,
        },
        planInformation: {
          amount: data.data.plan.amount,
          currency: data.data.plan.currency,
          name: data.data.plan.name,
          planCode: data.data.plan.plan_code,
        },
        subscrptionInformation: {
          code: data.data.subscription_code,
          token: data.data.email_token,
        },
      };
    } catch (error) {
      throw new HttpException(
        'An error occured while trying to get subscription information',
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
