import { Module } from '@nestjs/common';
import { OpenAiModule } from './open-ai/OpenAiModule';
import { MailChimpModule } from './mail-chimp/MailChimpModule';
import { FlutterwaveModule } from './flutterwave/FlutterwaveModule';

@Module({
  imports: [OpenAiModule, MailChimpModule, FlutterwaveModule],
  exports: [OpenAiModule, MailChimpModule, FlutterwaveModule],
})
export class IntegrationsModule {}
