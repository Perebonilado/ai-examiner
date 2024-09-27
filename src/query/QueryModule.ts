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

@Module({
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
    OneTimeSubscriptionQueryService
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
    OneTimeSubscriptionQueryService
  ],
})
export class QueryModule {}
