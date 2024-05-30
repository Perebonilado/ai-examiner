import { Module } from '@nestjs/common';
import { databaseProviders } from './providers/DatabaseProvider';
import { UserDbConnector } from './connectors/UserDbConnector';
import { CourseDbConnector } from './connectors/CourseDbConnector';
import { CourseDocumentDbConnector } from './connectors/CourseDocumentDbConnector';
import { QuestionDbConnector } from './connectors/QuestionDbConnector';
import { ScoreDbConnector } from './connectors/ScoreDbConnnector';
import { DocumentTopicDbConnector } from './connectors/DocumentTopicDbConnector';
import { QuestionTopicDbConnector } from './connectors/QuestionTopicDbConnector';

@Module({
  providers: [
    ...databaseProviders,
    UserDbConnector,
    CourseDbConnector,
    CourseDocumentDbConnector,
    QuestionDbConnector,
    ScoreDbConnector,
    DocumentTopicDbConnector,
    QuestionTopicDbConnector
  ],
  exports: [
    ...databaseProviders,
    UserDbConnector,
    CourseDbConnector,
    CourseDocumentDbConnector,
    QuestionDbConnector,
    ScoreDbConnector,
    DocumentTopicDbConnector,
    QuestionTopicDbConnector
  ],
})
export class InfraDbModule {}
