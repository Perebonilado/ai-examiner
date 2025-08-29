import { Module } from '@nestjs/common';
import { VapiCallingService } from './services/VapiCallingService';
import { VercelAIModule } from '../vercel-ai/VercelAIModule';

@Module({
  imports: [VercelAIModule],
  providers: [VapiCallingService],
  exports: [VapiCallingService],
})
export class VapiModule {}
