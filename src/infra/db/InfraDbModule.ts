import { Module } from '@nestjs/common';
import { databaseProviders } from './providers/DatabaseProvider';
import { UserDbConnector } from './connectors/UserDbConnector';
import { CourseDbConnector } from './connectors/CourseDbConnector';
import { CourseDocumentDbConnector } from './connectors/CourseDocumentDbConnector';
import { QuestionDbConnector } from './connectors/QuestionDbConnector';
import { ScoreDbConnector } from './connectors/ScoreDbConnnector';

@Module({
  providers: [
    ...databaseProviders,
    UserDbConnector,
    CourseDbConnector,
    CourseDocumentDbConnector,
    QuestionDbConnector,
    ScoreDbConnector
  ],
  exports: [
    ...databaseProviders,
    UserDbConnector,
    CourseDbConnector,
    CourseDocumentDbConnector,
    QuestionDbConnector,
    ScoreDbConnector
  ],
})
export class InfraDbModule {}
