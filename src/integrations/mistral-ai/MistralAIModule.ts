import { Module } from '@nestjs/common';
import { MistralOcrService } from './services/MistralOcrService';

@Module({
  providers: [MistralOcrService],
  exports: [MistralOcrService],
})
export class MistralAIModule {}
