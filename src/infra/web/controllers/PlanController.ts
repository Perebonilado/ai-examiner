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
      // use the ip address to determine the location and show plans accordingly. IP STACK
      const ipAddress = request.ip;

      const currencyCodesWithSpeicifcPlans = ['NGN'];
      const defaultCurrencyCode = 'USD';

      const ipDetails =
        await this.ipStackIpDetailsService.getIpDetails(ipAddress);

      const allPlans = await this.paystackPlansService.getPlans({
        page: page || 1,
        perPage: count || 50,
      });

      if (
        currencyCodesWithSpeicifcPlans.indexOf(ipDetails.currencyCode) !== -1
      ) {
        return allPlans.filter(
          (plan) => plan.currency === ipDetails.currencyCode,
        );
      } else {
        return allPlans.filter((plan) => plan.currency === defaultCurrencyCode);
      }
    } catch (error) {
      throw new HttpException(
        'Failed to get plans',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
