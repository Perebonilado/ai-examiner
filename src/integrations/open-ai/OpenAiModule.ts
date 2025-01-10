import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ExaminerService } from './services/ExaminerService';
import { SpeechService } from './services/SpeechService';
import { ILovePDFModule } from '../i-love-pdf/ILovePDFModule';

@Module({
  imports: [HttpModule, ILovePDFModule],
  providers: [ExaminerService, SpeechService],
  exports: [ExaminerService, SpeechService],
})
export class OpenAiModule {}
