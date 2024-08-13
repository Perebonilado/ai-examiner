import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { IpStackIpDetailsService } from 'src/integrations/ip-stack/services/IpStackIpDetailsService';
import { PaystackPlansService } from 'src/integrations/paystack/services/PaystackPlansService';

@Controller('plan')
export class PlanController {
  constructor(
    @Inject(PaystackPlansService)
    private paystackPlansService: PaystackPlansService,
    @Inject(IpStackIpDetailsService)
    private ipStackIpDetailsService: IpStackIpDetailsService,
  ) {}

  @Get()
  public async getPlans(
    @Query('page') page: number,
    @Query('count') count: number,
    @Req() request: Request,
  ) {
    try {
      const ipAddress = request.ip;

      const currencyCodesWithSpeicifcPlans = ['NGN'];
      const defaultCurrencyCode = 'NGN';

      const ipDetails =
        await this.ipStackIpDetailsService.getIpDetails(ipAddress);

      const allPlans = await this.paystackPlansService.getPlans({
        page: page || 1,
        perPage: count || 50,
      });

      const mappedPlans = allPlans.map((p)=>{
        return {...p, description: JSON.parse(p.description)}
      })

      if (
        currencyCodesWithSpeicifcPlans.indexOf(ipDetails.currencyCode) !== -1
      ) {
        return mappedPlans.filter(
          (plan) => plan.currency === ipDetails.currencyCode,
        );
      } else {
        return mappedPlans.filter((plan) => plan.currency === defaultCurrencyCode);
      }
    } catch (error) {
      throw new HttpException(
        'Failed to get plans',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
