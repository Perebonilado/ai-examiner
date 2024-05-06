import { Module } from '@nestjs/common';
import { databaseProviders } from './providers/DatabaseProvider';
import { UserDbConnector } from './connectors/UserDbConnector';
import { CourseDbConnector } from './connectors/CourseDbConnector';

@Module({
  providers: [...databaseProviders, UserDbConnector, CourseDbConnector],
  exports: [...databaseProviders, UserDbConnector, CourseDbConnector],
})
export class InfraDbModule {}
