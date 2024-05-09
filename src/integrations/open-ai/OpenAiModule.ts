import { Module } from '@nestjs/common';
import { AIExaminerService } from './services/AIExaminerService';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [AIExaminerService],
  exports: [AIExaminerService],
})
export class OpenAiModule {}
