import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import {
  CreateStandardPaymentModel,
  CreateStandardPaymentResponseModel,
} from '../models/CreateStandardPaymentModel';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { AxiosResponse } from 'axios';
import {
  CancelSubscriptionPayloadModel,
  CancelSubscriptionResponse,
  RetrieveSubscriptionModel,
  SubscriptionQueryModel,
} from '../models/SubscriptionModel';

@Injectable()
export class ManageSubscriptions {
  constructor(private httpService: HttpService) {}

  baseUrl = 'https://api.flutterwave.com/v3';

  public async makeInitialSubscriptionPayment(
    payload: CreateStandardPaymentModel,
  ) {
    try {
      const { data } = await this.httpService.axiosRef.post<
        any,
        AxiosResponse<CreateStandardPaymentResponseModel>
      >(
        `${this.baseUrl}/payments`,
        {
          json: {
            tx_ref: payload.txRef,
            amount: payload.amount,
            currency: payload.currency,
            redirect_url: payload.redirectUrl,
            payment_plan: payload.paymentPlan,
            customer: {
              email: payload.customer.email,
              name: payload.customer.name,
            },
            customizations: {
              title: 'AI Examiner',
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${EnvironmentVariables.config.flutterwaveSecretKey}`,
          },
        },
      );

      return data.data;
    } catch (error) {
      throw new HttpException(
        'An error occured while trying to process your payment',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  public async retrieveSubscription({
    email = '',
    page = '1',
    plan,
    status = '',
  }: SubscriptionQueryModel) {
    try {
      const query = <Record<string, string | number>>{};
      query.email = email;
      query.page = page;
      query.status = status;

      if (plan) {
        query.plan = plan;
      }

      const { data } = await this.httpService.axiosRef.get<
        AxiosResponse<RetrieveSubscriptionModel>
      >(`${this.baseUrl}/subscriptions`, {
        headers: {
          Authorization: `Bearer ${EnvironmentVariables.config.flutterwaveSecretKey}`,
        },
        params: query,
      });

      return data.data;
    } catch (error) {
      throw new HttpException(
        'An error occured while trying to find subscription',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  public async cancelSubscription(payload: CancelSubscriptionPayloadModel) {
    try {
      const { data } = await this.httpService.axiosRef.put<
        any,
        AxiosResponse<CancelSubscriptionResponse>
      >(`${this.baseUrl}/subscriptions/${payload.subscriptionId}/cancel`);

      return data.data;
    } catch (error) {
      throw new HttpException(
        'An error occured while trying to cancel subscription',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
