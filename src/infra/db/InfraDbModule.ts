import { Module } from '@nestjs/common';
import { databaseProviders } from './providers/DatabaseProvider';

@Module({
  providers: [...databaseProviders],
  exports: [...databaseProviders],
})
export class InfraDbModule {}
