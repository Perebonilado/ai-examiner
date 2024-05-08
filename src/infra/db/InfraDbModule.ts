import { Module } from '@nestjs/common';
import { databaseProviders } from './providers/DatabaseProvider';
import { UserDbConnector } from './connectors/UserDbConnector';
import { CourseDbConnector } from './connectors/CourseDbConnector';
import { CourseDocumentDbConnector } from './connectors/CourseDocumentDbConnector';

@Module({
  providers: [
    ...databaseProviders,
    UserDbConnector,
    CourseDbConnector,
    CourseDocumentDbConnector,
  ],
  exports: [
    ...databaseProviders,
    UserDbConnector,
    CourseDbConnector,
    CourseDocumentDbConnector,
  ],
})
export class InfraDbModule {}
