import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  StreamableFile,
} from '@nestjs/common';
import { translateEnglishToOtherLanguagePrompt } from 'src/constants/QuestionGenerationPromptV2';
import { TextToSpeechDto } from 'src/dto/TextToSpeechDto';
import { SpeechService } from 'src/integrations/open-ai/services/SpeechService';
import { AI } from 'src/integrations/vercel-ai/services/AI';
import { GEMINI_CONN } from 'src/integrations/vercel-ai/services/GeminiConn';
import { OPENAI_CONN } from 'src/integrations/vercel-ai/services/OpenAIConn';

@Controller('speech')
export class SpeechController {
  constructor(
    @Inject(SpeechService) private speechService: SpeechService,
    @Inject(GEMINI_CONN) private readonly geminiConn: AI,
    @Inject(OPENAI_CONN) private readonly openAIConn: AI,
  ) {}

  @Post('convert-text')
  public async converText(@Body() body: TextToSpeechDto) {
    try {
      let textToUse = body.text;

      if (body?.language?.toLowerCase() !== 'english') {
        const text = await this.openAIConn.generateText({
          prompt: translateEnglishToOtherLanguagePrompt(
            body.text,
            body.language,
          ),
        });

        textToUse = text;
      }

      const buffer = await this.speechService.textToSpeech(textToUse);

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
