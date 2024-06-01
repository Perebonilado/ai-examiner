import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { AxiosResponse } from 'axios';
import {
  GetPaymentPlansQueryModel,
  GetPaymentPlansResponseModel,
} from '../models/PaymentPlansModel';

@Injectable()
export class ManagePlans {
  constructor(private httpService: HttpService) {}

  baseUrl = 'https://api.flutterwave.com/v3';

  public async getPaymentPlants(query: GetPaymentPlansQueryModel) {
    try {
      const url = `${this.baseUrl}/payment-plans`;

      const { data } = await this.httpService.axiosRef.get<
        any,
        AxiosResponse<GetPaymentPlansResponseModel>
      >(url, {
        params: query,
        headers: {
          Authorization: `Bearer ${EnvironmentVariables.config.flutterwaveSecretKey}`,
        },
      });

      return data.data;
    } catch (error) {
      throw new HttpException(
        'An error occured while trying to find subscription',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
