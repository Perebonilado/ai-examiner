import { Module } from '@nestjs/common';
import { OpenAiModule } from './open-ai/OpenAiModule';
import { MailChimpModule } from './mail-chimp/MailChimpModule';
import { FlutterwaveModule } from './flutterwave/FlutterwaveModule';
import { MailerModule } from './mailer/MailerModule';
import { PaystackModule } from './paystack/PaystackModule';
import { IpStackModule } from './ip-stack/IpStackModule';

@Module({
  imports: [
    OpenAiModule,
    MailChimpModule,
    FlutterwaveModule,
    MailerModule,
    PaystackModule,
    IpStackModule
  ],
  exports: [
    OpenAiModule,
    MailChimpModule,
    FlutterwaveModule,
    MailerModule,
    PaystackModule,
    IpStackModule
  ],
})
export class IntegrationsModule {}
