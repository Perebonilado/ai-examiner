import {
    Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { TextToSpeechDto } from 'src/dto/TextToSpeechDto';
import { SpeechService } from 'src/integrations/open-ai/services/SpeechService';

@Controller('speech')
export class SpeechController {
  constructor(@Inject(SpeechService) private speechService: SpeechService) {}

  @Post('convert-text')
  public async converText(@Body() body: TextToSpeechDto) {
    try {
      const buffer = await this.speechService.textToSpeech(body.text);

      return new StreamableFile(buffer, {
        type: 'audio/mpeg',
        disposition: 'attachment; filename="voice.mp3"',
      });
    } catch (error) {
      throw new HttpException(
        'Failed to convert text to speech',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
