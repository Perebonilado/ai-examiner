import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ILovePdfService } from './services/ILovePdfService';

@Module({
  imports: [HttpModule],
  providers: [ILovePdfService],
  exports: [ILovePdfService],
})
export class ILovePDFModule {}
