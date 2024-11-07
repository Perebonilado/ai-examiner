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
    private ipInfoService: IpInfoService
  ) {}

  @Get()
  public async getPlans(
    @Query('page') page: number,
    @Query('count') count: number,
    @Req() request: Request,
  ) {
    try {
      const ipAddress = request['x-forwarded-for'] || request.connection.remoteAddress || request.ip;

      const nairaCurrencyCode = 'NGN';
      const usdCurrencyCode = 'USD'
      let isUsersCountryNigeria = true;
      let isUsersContinentAfrica = true;

      const ipDetails =
        await this.ipInfoService.getIpDetails(ipAddress);

      if (ipDetails && ipDetails.country?.toLowerCase() !== 'ng') {
        isUsersCountryNigeria = false;
      }

      if (ipDetails && !ipDetails.timezone?.toLowerCase().includes("africa")) {
        isUsersContinentAfrica = false;
      }

      const allPlans = await this.paystackPlansService.getPlans({
        page: page || 1,
        perPage: count || 50,
      });

      const mappedPlans = allPlans.map((p) => {
        return { ...p, description: JSON.parse(p.description) };
      });

      if (isUsersContinentAfrica) {
        if (isUsersCountryNigeria) {
          return mappedPlans.filter(
            (plan) => plan.currency === nairaCurrencyCode,
          );
        } else {
          return mappedPlans.filter((plan) => {
            const africanRegionalPlans = (
              plan.description as {
                title: string;
                isAvailable: boolean;
                continent?: string;
              }[]
            ).find((d) => d?.continent === 'Africa') && plan.currency === usdCurrencyCode;

            return africanRegionalPlans ? true : false;
          });
        }
      } else {
        return mappedPlans.filter((plan) => {
          const northAmericanRegionalPlans = (
            plan.description as {
              title: string;
              isAvailable: boolean;
              continent?: string;
            }[]
          ).find((d) => d?.continent === 'North America');

          return northAmericanRegionalPlans ? true : false;
        });
      }
    } catch (error) {
      throw new HttpException(
        'Failed to get plans',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
