import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Res,
} from '@nestjs/common';
import { VapiCallEndedDto } from '../dto/VapiCallEndedDto';
import { Response } from 'express';
import { CreateOralQuestionAnalysisHandler } from 'src/business/handlers/OralQuestionAnalysis/CreateOralQuestionAnalysisHandler';

@Controller('webhook/vapi')
export class VapiWebhook {
  constructor(
    @Inject(CreateOralQuestionAnalysisHandler)
    private createOralQuestionAnalysisHandler: CreateOralQuestionAnalysisHandler,
  ) {}

  @Post('')
  public async callEnded(
    @Body() body: VapiCallEndedDto,
    @Res() response: Response,
  ) {
    // acknowledge
    response.sendStatus(200);

    try {
      if (body.endedReason === 'hangup') {
        await this.createOralQuestionAnalysisHandler.handle({ data: body });
      }
      // send email report
    } catch (error) {
      throw new HttpException(
        'Failed to handle call ended request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
