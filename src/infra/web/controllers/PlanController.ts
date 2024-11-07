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
import { IpInfoService } from 'src/integrations/ip-info/services/IpInfoService';
import { IpStackIpDetailsService } from 'src/integrations/ip-stack/services/IpStackIpDetailsService';
import { PaystackPlansService } from 'src/integrations/paystack/services/PaystackPlansService';

@Controller('plan')
export class PlanController {
  constructor(
    @Inject(PaystackPlansService)
    private paystackPlansService: PaystackPlansService,
    @Inject(IpInfoService)
    private ipInfoService: IpInfoService,
  ) {}

  @Get()
  public async getPlans(
    @Query('page') page: number,
    @Query('count') count: number,
  ) {
    try {
      const allPlans = await this.paystackPlansService.getPlans({
        page: page || 1,
        perPage: count || 50,
      });

      const mappedPlans = allPlans.map((p) => {
        return { ...p, description: JSON.parse(p.description) };
      });

      return mappedPlans;
    } catch (error) {
      throw new HttpException(
        'Failed to get plans',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
