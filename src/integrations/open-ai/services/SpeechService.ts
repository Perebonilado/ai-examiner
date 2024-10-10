import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { EnvironmentVariables } from 'src/EnvironmentVariables';

@Injectable()
export class SpeechService {
  constructor() {
    this.intializeOpenAiClient();
  }

  private openAiClient: OpenAI;

  private intializeOpenAiClient() {
    try {
      this.openAiClient = new OpenAI({
        apiKey: EnvironmentVariables.config.openAiApiKey,
      });
    } catch (error) {
      throw new HttpException(
        'Falied to initialize open AI client',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  public async textToSpeech(text: string) {
    try {
      const mp3 = await this.openAiClient.audio.speech.create({
        model: 'tts-1',
        voice: 'shimmer',
        input: text,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer())

      return buffer
    } catch (error) {
      throw new HttpException(
        'Falied to convert text to speech',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
