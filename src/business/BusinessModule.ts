import { Module } from '@nestjs/common';
import { CreateUserHandler } from './handlers/User/CreateUserHandler';
import { QueryModule } from 'src/query/QueryModule';
import { InfraRepositoryModule } from 'src/infra/db/InfraRepositoryModule';
import { IntegrationsModule } from 'src/integrations/IntegrationsModule';

@Module({
  imports: [QueryModule, InfraRepositoryModule, IntegrationsModule],
  providers: [CreateUserHandler],
  exports: [CreateUserHandler],
})
export class BusinessModule {}
