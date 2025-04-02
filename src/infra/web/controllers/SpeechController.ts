import { createOpenAI } from '@ai-sdk/openai';
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
import { generateText } from 'ai';
import { translateEnglishToOtherLanguagePrompt } from 'src/constants/QuestionGenerationPromptV2';
import { TextToSpeechDto } from 'src/dto/TextToSpeechDto';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { SpeechService } from 'src/integrations/open-ai/services/SpeechService';

@Controller('speech')
export class SpeechController {
  constructor(@Inject(SpeechService) private speechService: SpeechService) {}

  @Post('convert-text')
  public async converText(@Body() body: TextToSpeechDto) {
    try {
      let textToUse = body.text;

      if (body?.language?.toLowerCase() !== 'english') {
        const openai = createOpenAI({
          compatibility: 'strict',
          apiKey: EnvironmentVariables.config.openAiApiKey,
        });

        const { text } = await generateText({
          model: openai.responses('gpt-4o-mini'),
          maxRetries: 3,
          prompt: translateEnglishToOtherLanguagePrompt(body.text, body.language),
        });

        textToUse = text
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
