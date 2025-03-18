import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ExaminerService } from './services/ExaminerService';
import { SpeechService } from './services/SpeechService';
import { ILovePDFModule } from '../i-love-pdf/ILovePDFModule';
import { PineconeModule } from '../pinecone/PineconeModule';
import { MistralAIModule } from '../mistral-ai/MistralAIModule';

@Module({
  imports: [HttpModule, ILovePDFModule, PineconeModule, MistralAIModule],
  providers: [ExaminerService, SpeechService],
  exports: [ExaminerService, SpeechService],
})
export class OpenAiModule {}
