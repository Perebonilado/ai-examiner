import { Module } from '@nestjs/common';
import { UserQueryService } from './services/UserQueryService';
import { CourseQueryService } from './services/CourseQueryService';
import { CourseDocumentQueryService } from './services/CourseDocumentQueryService';
import { QuestionQueryService } from './services/QuestionQueryService';
import { ScoreQueryService } from './services/ScoreQueryService';
import { DocumentTopicQueryService } from './services/DocumentTopicQueryService';
import { QuestionTopicQueryService } from './services/QuestionTopicQueryService';
import { LookUpQueryService } from './services/LookUpQueryService';
import { SubscriptionQueryService } from './services/SubscriptionQueryService';
import { PlanPermissionQueryService } from './services/PlanPermissionQueryService';
import { PermissionQueryService } from './services/PermissionQueryService';
import { DocumentMessageQueryService } from './services/DocumentMessageQueryService';
import { OneTimeSubscriptionQueryService } from './services/OneTimeSubscriptionQueryService';
import { QuestionProgressQueryService } from './services/QuestionProgressQueryService';
import { PerformanceTrackingQueryService } from './services/PerformanceTrackingQueryService';
import { OralQuestionAnalysisQueryService } from './services/OralQuestionAnalysisQueryService';
import { IntegrationsModule } from 'src/integrations/IntegrationsModule';
import { CallCreditsQueryService } from './services/CallCreditsQueryService';
import { FlaggedQuestionQueryService } from './services/FlaggedQuestionQueryService';
import { FlaggedDocumentMessageQueryService } from './services/FlaggedDocumentMessageQueryService';
import { PreferredLanguageQueryService } from './services/PreferredLanguageQueryService';
import { EssayQuestionAnalysisQueryService } from './services/EssayQuestionAnalysisQueryService';
import { DocumentSummaryQueryService } from './services/DocumentSummaryQueryService';
import { RelatedVideoQueryService } from './services/RelatedVideoQueryService';
import { StoredFileQueryService } from './services/StoredFileQueryService';
import { DocumentReadingProgressQueryService } from './services/DocumentReadingProgressQueryService';

@Module({
  imports: [IntegrationsModule],
  providers: [
    UserQueryService,
    CourseQueryService,
    CourseDocumentQueryService,
    QuestionQueryService,
    ScoreQueryService,
    DocumentTopicQueryService,
    QuestionTopicQueryService,
    LookUpQueryService,
    SubscriptionQueryService,
    PlanPermissionQueryService,
    PermissionQueryService,
    DocumentMessageQueryService,
    OneTimeSubscriptionQueryService,
    QuestionProgressQueryService,
    PerformanceTrackingQueryService,
    OralQuestionAnalysisQueryService,
    CallCreditsQueryService,
    FlaggedQuestionQueryService,
    FlaggedDocumentMessageQueryService,
    PreferredLanguageQueryService,
    EssayQuestionAnalysisQueryService,
    DocumentSummaryQueryService,
    RelatedVideoQueryService,
    StoredFileQueryService,
    DocumentReadingProgressQueryService
  ],
  exports: [
    UserQueryService,
    CourseQueryService,
    CourseDocumentQueryService,
    QuestionQueryService,
    ScoreQueryService,
    DocumentTopicQueryService,
    QuestionTopicQueryService,
    LookUpQueryService,
    SubscriptionQueryService,
    PlanPermissionQueryService,
    PermissionQueryService,
    DocumentMessageQueryService,
    OneTimeSubscriptionQueryService,
    QuestionProgressQueryService,
    PerformanceTrackingQueryService,
    OralQuestionAnalysisQueryService,
    CallCreditsQueryService,
    FlaggedDocumentMessageQueryService,
    PreferredLanguageQueryService,
    EssayQuestionAnalysisQueryService,
    DocumentSummaryQueryService,
    RelatedVideoQueryService,
    StoredFileQueryService,
    DocumentReadingProgressQueryService
  ],
})
export class QueryModule {}
