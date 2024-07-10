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
import { PaystackPlansService } from 'src/integrations/paystack/services/PaystackPlansService';

@Controller('plan')
export class PlanController {
  constructor(
    @Inject(PaystackPlansService)
    private paystackPlansService: PaystackPlansService,
  ) {}

  @Get()
  public async getPlans(
    @Query('page') page: number,
    @Query('count') count: number,
    @Req() request: Request,
  ) {
    try {

      // use the ip address to determine the location and show plans accordingly. IP STACK
      const ipAddress = request.ip
      
      return await this.paystackPlansService.getPlans({
        page: page || 1,
        perPage: count || 50,
      });
    } catch (error) {
      throw new HttpException(
        'Failed to get plans',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
