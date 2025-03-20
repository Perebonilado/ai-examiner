import { HttpService } from '@nestjs/axios';
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { CreateCallCreditsPaymentModel } from '../models/CreateCallCreditsPayloadModel';
import { InitializeTransactionDto } from '../dto/InitializeTransactionDto';

@Injectable()
export class PaystackCallCreditsService {
  constructor(private httpService: HttpService) {}

  private baseUrl = 'https://api.paystack.co';

  public async createCallCreditsPayment(
    payload: CreateCallCreditsPaymentModel,
  ) {
    try {
      const { amount, currency, email, timePurchasedMs } = payload;
      let paymantChannels = ['bank_transfer', 'card', 'bank', 'ussd'];

      if (currency === 'USD') {
        paymantChannels = paymantChannels.filter(
          (channel) => channel === 'card',
        );
      }

      const { data } = await this.httpService.axiosRef.post<
        any,
        AxiosResponse<InitializeTransactionDto>
      >(
        `${this.baseUrl}/transaction/initialize`,
        {
          amount,
          email,
          currency,
          channels: paymantChannels,
          metadata: {
            cancel_action: `${EnvironmentVariables.config.frontendBaseUrl}`,
            purchase_type: 'call_credits',
            time_purchased_ms: timePurchasedMs,
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
        'An error occured while trying to process call credits payment',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
