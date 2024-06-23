import { Module } from '@nestjs/common';
import { OpenAiModule } from './open-ai/OpenAiModule';
import { MailChimpModule } from './mail-chimp/MailChimpModule';
import { FlutterwaveModule } from './flutterwave/FlutterwaveModule';
import { MailerModule } from './mailer/MailerModule';

@Module({
  imports: [OpenAiModule, MailChimpModule, FlutterwaveModule, MailerModule],
  exports: [OpenAiModule, MailChimpModule, FlutterwaveModule, MailerModule],
})
export class IntegrationsModule {}
