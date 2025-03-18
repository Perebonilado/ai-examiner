import { Module } from '@nestjs/common';
import { ILovePDFModule } from '../i-love-pdf/ILovePDFModule';
import { ExtractTextService } from './services/ExtractTextService';
import { MistralAIModule } from '../mistral-ai/MistralAIModule';

@Module({
  imports: [ILovePDFModule, MistralAIModule],
  providers: [ExtractTextService],
  exports: [ExtractTextService],
})
export class TextExtractionModule {}
