import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ExaminerService } from './services/ExaminerService';

@Module({
  imports: [HttpModule],
  providers: [ExaminerService],
  exports: [ExaminerService],
})
export class OpenAiModule {}
