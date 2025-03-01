import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { VapiCallEndedDto } from '../dto/VapiCallEndedDto';
import { Response } from 'express';

@Controller('webhook/vapi')
export class VapiWebhook {
  @Post('')
  public async callEnded(@Body() body: VapiCallEndedDto, @Res() response: Response,) {
    // acknowledge
    response.sendStatus(200);
    
    try {
      if(body.endedReason === 'hangup'){
        // call  probably went well and ended
        // analyse response
      }
      // yet to be implemented
    } catch (error) {
      throw new HttpException(
        'Failed to handle call ended request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
