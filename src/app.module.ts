import { Module } from '@nestjs/common';
import { IntegrationsModule } from './integrations/IntegrationsModule';
import { InfraWebModule } from './infra/web/InfraWebModule';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot(), IntegrationsModule, InfraWebModule],
})
export class AppModule {}
