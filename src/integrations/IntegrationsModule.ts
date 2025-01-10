import { Module } from '@nestjs/common';
import { OpenAiModule } from './open-ai/OpenAiModule';
import { MailChimpModule } from './mail-chimp/MailChimpModule';
import { FlutterwaveModule } from './flutterwave/FlutterwaveModule';
import { MailerModule } from './mailer/MailerModule';
import { PaystackModule } from './paystack/PaystackModule';
import { IpStackModule } from './ip-stack/IpStackModule';
import { FloDeskMailerModule } from './flo-desk-mailer/FloDeskMailerModule';
import { IpInfoModule } from './ip-info/IpInfoModule';
import { ILovePDFModule } from './i-love-pdf/ILovePDFModule';

@Module({
  imports: [
    OpenAiModule,
    MailChimpModule,
    FlutterwaveModule,
    MailerModule,
    PaystackModule,
    IpStackModule,
    FloDeskMailerModule,
    IpInfoModule,
    ILovePDFModule
  ],
  exports: [
    OpenAiModule,
    MailChimpModule,
    FlutterwaveModule,
    MailerModule,
    PaystackModule,
    IpStackModule,
    FloDeskMailerModule,
    IpInfoModule,
    ILovePDFModule
  ],
})
export class IntegrationsModule {}
