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
    @Query('showEssayQuestionOption')
    showEssayQuestionOption = '0',
  ) {
    try {
      let lookUps = await this.lookUpQueryService.findAllLookUpsByType(type);
      if (type === 'question_type' && Number(showOralQuestionOption) !== 1) {
        lookUps = lookUps.filter(
          (lk) => !lk.title.toLowerCase().includes('oral'),
        );
      }

      if (type === 'question_type' && Number(showEssayQuestionOption) !== 1) {
        lookUps = lookUps.filter(
          (lk) => !lk.title.toLowerCase().includes('essay'),
        );
      }

      return lookUps;
    } catch (error) {
      throw new HttpException('Failed to find lookups', HttpStatus.NOT_FOUND);
    }
  }
}
