import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Query,
} from '@nestjs/common';
import { LookUpQueryService } from 'src/query/services/LookUpQueryService';

@Controller('look-up')
export class LookUpController {
  constructor(
    @Inject(LookUpQueryService) private lookUpQueryService: LookUpQueryService,
  ) {}

  @Get('')
  public async getLookUps(@Query('type') type: string) {
    try {
      return await this.lookUpQueryService.findAllLookUpsByType(type);
    } catch (error) {
      throw new HttpException('Failed to find lookups', HttpStatus.NOT_FOUND);
    }
  }
}
