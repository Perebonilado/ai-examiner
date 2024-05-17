import { Module } from '@nestjs/common';
import { IntegrationsModule } from './integrations/IntegrationsModule';
import { InfraWebModule } from './infra/web/InfraWebModule';
import { ConfigModule } from '@nestjs/config';
import { InfraDbModule } from './infra/db/InfraDbModule';
import { InfraRepositoryModule } from './infra/db/InfraRepositoryModule';
import { QueryModule } from './query/QueryModule';
import { BusinessModule } from './business/BusinessModule';
import { GoogleStrategy } from './infra/auth/strategies/google.strategy';

@Module({
  imports: [
    ConfigModule.forRoot(),
    IntegrationsModule,
    InfraWebModule,
    InfraDbModule,
    InfraRepositoryModule,
    QueryModule,
    BusinessModule
  ],
  providers: [GoogleStrategy]
})
export class AppModule {}
