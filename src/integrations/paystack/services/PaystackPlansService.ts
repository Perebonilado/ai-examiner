import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ListPlansPayloadModel, PlanModel } from '../models/ListPlansModel';
import { AxiosResponse } from 'axios';
import { PlanDto } from '../dto/ListPlanDto';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { convertSmallerDemoninationtoLarger } from 'src/utils';

@Injectable()
export class PaystackPlansService {
  constructor(private httpService: HttpService) {}

  private baseUrl = 'https://api.paystack.co';

  public async getPlans({
    page = 1,
    perPage = 20,
  }: ListPlansPayloadModel): Promise<PlanModel[]> {
    try {
      const { data } = await this.httpService.axiosRef.get<
        any,
        AxiosResponse<PlanDto>
      >(`${this.baseUrl}/plan`, {
        params: {
          page,
          perPage,
        },
        headers: {
          Authorization: `Bearer ${EnvironmentVariables.config.paystackSecretKey}`,
        },
      });

      return data.data.map((pl) => ({
        planName: pl.name,
        planId: pl.plan_code,
        currency: pl.currency,
        amount: convertSmallerDemoninationtoLarger(pl.amount, 100),
        description: pl.description,
      }));
    } catch (error) {
      throw new HttpException('Failed to get plans', HttpStatus.BAD_GATEWAY);
    }
  }
}
