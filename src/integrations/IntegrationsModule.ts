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
import { VapiModule } from './vapi/VapiModule';
import { MistralAIModule } from './mistral-ai/MistralAIModule';
import { PineconeModule } from './pinecone/PineconeModule';
import { TextExtractionModule } from './text-extraction/TextExtractionModule';
import { GoogleModule } from './google/GoogleModule';
import { RapidModule } from './rapid/RapidModule';
import { AsposeModule } from './aspose/AsposeModule';
import { VercelAIModule } from './vercel-ai/VercelAIModule';

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
    ILovePDFModule,
    VapiModule,
    MistralAIModule,
    PineconeModule,
    TextExtractionModule,
    GoogleModule,
    RapidModule,
    AsposeModule,
    VercelAIModule,
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
    ILovePDFModule,
    VapiModule,
    MistralAIModule,
    PineconeModule,
    TextExtractionModule,
    GoogleModule,
    RapidModule,
    AsposeModule,
    VercelAIModule,
  ],
})
export class IntegrationsModule {}
