import { Module } from '@nestjs/common';
import { MistralOcrService } from './services/MistralOcrService';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [MistralOcrService],
  exports: [MistralOcrService],
})
export class MistralAIModule {}
