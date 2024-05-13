import { Module } from '@nestjs/common';
import { OpenAiModule } from './open-ai/OpenAiModule';

@Module({
  imports: [OpenAiModule],
  exports: [OpenAiModule],
})
export class IntegrationsModule {}
