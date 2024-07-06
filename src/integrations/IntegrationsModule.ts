import { Module } from '@nestjs/common';
import { OpenAiModule } from './open-ai/OpenAiModule';
import { MailChimpModule } from './mail-chimp/MailChimpModule';
import { FlutterwaveModule } from './flutterwave/FlutterwaveModule';
import { MailerModule } from './mailer/MailerModule';
import { PaystackModule } from './paystack/PaystackModule';

@Module({
  imports: [
    OpenAiModule,
    MailChimpModule,
    FlutterwaveModule,
    MailerModule,
    PaystackModule,
  ],
  exports: [
    OpenAiModule,
    MailChimpModule,
    FlutterwaveModule,
    MailerModule,
    PaystackModule,
  ],
})
export class IntegrationsModule {}
