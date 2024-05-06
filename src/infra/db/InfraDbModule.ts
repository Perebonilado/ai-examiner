import { Module } from '@nestjs/common';
import { databaseProviders } from './providers/DatabaseProvider';
import { UserDbConnector } from './connectors/UserDbConnector';

@Module({
  providers: [...databaseProviders, UserDbConnector],
  exports: [...databaseProviders, UserDbConnector],
})
export class InfraDbModule {}
