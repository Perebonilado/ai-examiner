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
import { OralQuestionAnalysisDbConnector } from './connectors/OralQuestionAnalysisDbConnector';
import { CallCreditsDbConnector } from './connectors/CallCreditsDbConnector';
import { FlaggedQuestionDbConnector } from './connectors/FlaggedQuestionDbConnector';
import { FlaggedDocumentMessageDbConnector } from './connectors/FlaggedDocumentMessageModelDbConnector';
import { PreferredLanguageDbConnector } from './connectors/PreferredLanguageDbConnector';
import { EssayQuestionAnalysisDbConnector } from './connectors/EssayQuestionAnalysisDbConnector';
import { DocumentSummaryDbConnector } from './connectors/DocumentSummaryDbConnector';
import { RelatedVideoDbConnector } from './connectors/RelatedVideoDbConnector';
import { StoredFileDbConnector } from './connectors/StoredFileDbConnector';
import { DocumentReadingProgressModel } from './models/DocumentReadingProgress';
import { DocumentReadingProgressDbConnector } from './connectors/DocumentReadingProgressDbConntector';

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
    PerformanceTrackingDbConnector,
    OralQuestionAnalysisDbConnector,
    CallCreditsDbConnector,
    FlaggedQuestionDbConnector,
    FlaggedDocumentMessageDbConnector,
    PreferredLanguageDbConnector,
    EssayQuestionAnalysisDbConnector,
    DocumentSummaryDbConnector,
    RelatedVideoDbConnector,
    StoredFileDbConnector,
    DocumentReadingProgressDbConnector,
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
    PerformanceTrackingDbConnector,
    OralQuestionAnalysisDbConnector,
    CallCreditsDbConnector,
    FlaggedQuestionDbConnector,
    FlaggedDocumentMessageDbConnector,
    PreferredLanguageDbConnector,
    EssayQuestionAnalysisDbConnector,
    DocumentSummaryDbConnector,
    RelatedVideoDbConnector,
    StoredFileDbConnector,
    DocumentReadingProgressDbConnector,
  ],
})
export class InfraDbModule {}
