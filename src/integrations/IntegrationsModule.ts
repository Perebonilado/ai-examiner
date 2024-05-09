import { Module } from '@nestjs/common';
import { OpenAiModule } from './open-ai/OpenAiModule';
import { AwsModule } from './aws/AwsModule';

@Module({
  imports: [OpenAiModule, AwsModule,],
  exports: [OpenAiModule, AwsModule],
})
export class IntegrationsModule {}
