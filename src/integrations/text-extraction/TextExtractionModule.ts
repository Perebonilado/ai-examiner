import { Module } from '@nestjs/common';
import { ILovePDFModule } from '../i-love-pdf/ILovePDFModule';
import { ExtractTextService } from './services/ExtractTextService';

@Module({
  imports: [ILovePDFModule],
  providers: [ExtractTextService],
  exports: [ExtractTextService],
})
export class TextExtractionModule {}
