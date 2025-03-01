import { Controller, HttpException, HttpStatus, Post } from '@nestjs/common';

@Controller('webhook/vapi')
export class VapiWebhook {
  @Post('')
  public async callEnded() {
    try {
      // yet to be implemented
    } catch (error) {
      throw new HttpException(
        'Failed to handle call ended request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
