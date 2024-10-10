import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ExaminerService } from './services/ExaminerService';
import { SpeechService } from './services/SpeechService';

@Module({
  imports: [HttpModule],
  providers: [ExaminerService, SpeechService],
  exports: [ExaminerService, SpeechService],
})
export class OpenAiModule {}
