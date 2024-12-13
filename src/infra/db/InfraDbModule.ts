import { Module } from '@nestjs/common';
import { databaseProviders } from './providers/DatabaseProvider';
import { UserDbConnector } from './connectors/UserDbConnector';
import { CourseDbConnector } from './connectors/CourseDbConnector';
import { CourseDocumentDbConnector } from './connectors/CourseDocumentDbConnector';
import { QuestionDbConnector } from './connectors/QuestionDbConnector';
import { ScoreDbConnector } from './connectors/ScoreDbConnnector';
import { DocumentTopicDbConnector } from './connectors/DocumentTopicDbConnector';
import { QuestionTopicDbConnector } from './connectors/QuestionTopicDbConnector';
import { QueryModule } from 'src/query/QueryModule';
import { SubscriptionDbConnector } from './connectors/SubscriptionDbConnector';
import { DocumentMessageDbConnector } from './connectors/DocumentMessageDbConnector';
import { OneTimeSubscriptionDbConnector } from './connectors/OneTimeSubscriptionDbConnector';
import { QuestionProgressDbConnector } from './connectors/QuestionProgressDbConnector';
import { PerformanceTrackingDbConnector } from './connectors/PerformanceTrackingDbConnector';

@Module({
  imports: [QueryModule],
  providers: [
    ...databaseProviders,
    UserDbConnector,
    CourseDbConnector,
    CourseDocumentDbConnector,
    QuestionDbConnector,
    ScoreDbConnector,
    DocumentTopicDbConnector,
    QuestionTopicDbConnector,
    SubscriptionDbConnector,
    DocumentMessageDbConnector,
    OneTimeSubscriptionDbConnector,
    QuestionProgressDbConnector,
    PerformanceTrackingDbConnector
  ],
  exports: [
    ...databaseProviders,
    UserDbConnector,
    CourseDbConnector,
    CourseDocumentDbConnector,
    QuestionDbConnector,
    ScoreDbConnector,
    DocumentTopicDbConnector,
    QuestionTopicDbConnector,
    SubscriptionDbConnector,
    DocumentMessageDbConnector,
    OneTimeSubscriptionDbConnector,
    QuestionProgressDbConnector,
    PerformanceTrackingDbConnector
  ],
})
export class InfraDbModule {}
