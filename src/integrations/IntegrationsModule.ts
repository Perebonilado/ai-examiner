import { Module } from '@nestjs/common';
import { OpenAiModule } from './open-ai/OpenAiModule';
import { MailChimpModule } from './mail-chimp/MailChimpModule';
import { FlutterwaveModule } from './flutterwave/FlutterwaveModule';
import { MailerModule } from './mailer/MailerModule';
import { PaystackModule } from './paystack/PaystackModule';
import { IpStackModule } from './ip-stack/IpStackModule';
import { FloDeskMailerModule } from './flo-desk-mailer/FloDeskMailerModule';

@Module({
  imports: [
    OpenAiModule,
    MailChimpModule,
    FlutterwaveModule,
    MailerModule,
    PaystackModule,
    IpStackModule,
    FloDeskMailerModule
  ],
  exports: [
    OpenAiModule,
    MailChimpModule,
    FlutterwaveModule,
    MailerModule,
    PaystackModule,
    IpStackModule,
    FloDeskMailerModule
  ],
})
export class IntegrationsModule {}
