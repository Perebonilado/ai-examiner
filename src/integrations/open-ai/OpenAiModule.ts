import { Module } from '@nestjs/common';
import { AIExaminerService } from './services/AIExaminerService';

@Module({
  providers: [AIExaminerService],
  exports: [AIExaminerService],
})
export class OpenAiModule {}
