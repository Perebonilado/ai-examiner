import { Module } from '@nestjs/common';
import { FileConversionService } from './services/FileConversionService';

@Module({
  imports: [],
  providers: [FileConversionService],
  exports: [FileConversionService],
})
export class AsposeModule {}
