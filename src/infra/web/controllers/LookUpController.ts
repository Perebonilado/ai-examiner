import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { LookUpQueryService } from 'src/query/services/LookUpQueryService';

@Controller('look-up')
export class LookUpController {
  constructor(
    @Inject(LookUpQueryService) private lookUpQueryService: LookUpQueryService,
  ) {}

  @Get('')
  public async getLookUps(
    @Query('type') type: string,
    @Query('showOralQuestionOption')
    showOralQuestionOption = '0',
  ) {
    try {
      const lookUps = await this.lookUpQueryService.findAllLookUpsByType(type);
      if (type === 'question_type' && Number(showOralQuestionOption) !== 1) {
        return lookUps.filter((lk) => !lk.title.toLowerCase().includes('oral'));
      }
      return lookUps;
    } catch (error) {
      throw new HttpException('Failed to find lookups', HttpStatus.NOT_FOUND);
    }
  }
}
