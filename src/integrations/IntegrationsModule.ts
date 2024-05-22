import { Module } from '@nestjs/common';
import { OpenAiModule } from './open-ai/OpenAiModule';
import { MailChimpModule } from './mail-chimp/MailChimpModule';

@Module({
  imports: [OpenAiModule, MailChimpModule],
  exports: [OpenAiModule, MailChimpModule],
})
export class IntegrationsModule {}
