import { Module } from '@nestjs/common';
import { AIExaminerService } from './services/AIExaminerService';
import { HttpModule } from '@nestjs/axios';
import { ExaminerService } from './services/ExaminerService';

@Module({
  imports: [HttpModule],
  providers: [AIExaminerService, ExaminerService],
  exports: [AIExaminerService, ExaminerService],
})
export class OpenAiModule {}
