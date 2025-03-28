import { Module } from '@nestjs/common';
import { InfraDbModule } from './InfraDbModule';
import { UserRepository } from 'src/business/repository/UserRepository';
import { UserSequelizeRepository } from './repository/UserSequelizeRepository';
import { CourseSequelizeRepository } from './repository/CourseSequelizeRepository';
import { CourseRepository } from 'src/business/repository/CourseRepository';
import { CourseDocumentRepository } from 'src/business/repository/CourseDocumentRepository';
import { CourseDocumentSequelizeRepository } from './repository/CourseDocumentSequelizeRepository';
import { QuestionRepository } from 'src/business/repository/QuestionRepository';
import { QuestionSequelizeRepository } from './repository/QuestionSequelizeRepository';
import { ScoreRepository } from 'src/business/repository/ScoreRepository';
import { ScoreSequelizeRepository } from './repository/ScoreSequelizeRepository';
import { DocumentTopicRepository } from 'src/business/repository/DocumentTopicRepository';
import { DocumentTopicSequelizeRepository } from './repository/DocumentTopicSequelizeRepository';
import { QuestionTopicRepository } from 'src/business/repository/QuestionTopicRepository';
import { QuestionTopicSequelizeRepository } from './repository/QuestionTopicSequelizeRepository';
import { SubscriptionRepository } from 'src/business/repository/SubscriptionRepository';
import { SubscriptionSequelizeRepository } from './repository/SubscriptionSequelizeRepository';
import { QueryModule } from 'src/query/QueryModule';
import { DocumentMessageRepository } from 'src/business/repository/DocumentMessageRepository';
import { DocumentMessageSequelizeRepository } from './repository/DocumentMessageSequelizeRepository';
import { OneTimeSubscriptionRepository } from 'src/business/repository/OneTimeSubscriptionRepository';
import { OneTimeSubscriptionSequelizeRepository } from './repository/OneTimeSubscriptionSequelizeRepository';
import { QuestionProgressRepository } from 'src/business/repository/QuestionProgressRepository';
import { QuestionProgressSequelizeRepository } from './repository/QuestionProgressSequelizeRepository';
import { PerformanceTrackingRepository } from 'src/business/repository/PerformanceTrackingRepository';
import { PerformanceTrackingSequelizeRepository } from './repository/PerformanceTrackingSequelizeRepository';
import { OralQuestionAnalysisRepository } from 'src/business/repository/OralQuestionAnalysisRepository';
import { OralQuestionAnalysisSequelizeRepository } from './repository/OralQuestionAnalysisSequelizeRepository';
import { CallCreditsRepository } from 'src/business/repository/CallCreditsRepository';
import { CallCreditsSequelizeRepository } from './repository/CallCreditsSequelizeRepository';
import { FlaggedQuestionRepository } from 'src/business/repository/FlaggedQuestionRepository';
import { FlaggedQuestionSequelizeRepository } from './repository/FlaggedQuestionSequelizeRepository';
import { FlaggedDocumentMessageRepository } from 'src/business/repository/FlaggedDocumentMessageRepository';
import { FlaggedDocumentMessageSequelizeRepository } from './repository/FlaggedDocumentMessageSequelizeRepository';

@Module({
  imports: [InfraDbModule, QueryModule],
  providers: [
    {
      provide: UserRepository,
      useClass: UserSequelizeRepository,
    },
    {
      provide: CourseRepository,
      useClass: CourseSequelizeRepository,
    },
    {
      provide: CourseDocumentRepository,
      useClass: CourseDocumentSequelizeRepository,
    },
    {
      provide: QuestionRepository,
      useClass: QuestionSequelizeRepository,
    },
    {
      provide: ScoreRepository,
      useClass: ScoreSequelizeRepository,
    },
    {
      provide: DocumentTopicRepository,
      useClass: DocumentTopicSequelizeRepository,
    },
    {
      provide: QuestionTopicRepository,
      useClass: QuestionTopicSequelizeRepository,
    },
    {
      provide: SubscriptionRepository,
      useClass: SubscriptionSequelizeRepository,
    },
    {
      provide: DocumentMessageRepository,
      useClass: DocumentMessageSequelizeRepository,
    },
    {
      provide: OneTimeSubscriptionRepository,
      useClass: OneTimeSubscriptionSequelizeRepository,
    },
    {
      provide: QuestionProgressRepository,
      useClass: QuestionProgressSequelizeRepository,
    },
    {
      provide: PerformanceTrackingRepository,
      useClass: PerformanceTrackingSequelizeRepository,
    },
    {
      provide: OralQuestionAnalysisRepository,
      useClass: OralQuestionAnalysisSequelizeRepository,
    },
    {
      provide: CallCreditsRepository,
      useClass: CallCreditsSequelizeRepository,
    },
    {
      provide: FlaggedQuestionRepository,
      useClass: FlaggedQuestionSequelizeRepository,
    },
    {
      provide: FlaggedDocumentMessageRepository,
      useClass: FlaggedDocumentMessageSequelizeRepository,
    },
  ],
  exports: [
    UserRepository,
    CourseRepository,
    CourseDocumentRepository,
    QuestionRepository,
    ScoreRepository,
    DocumentTopicRepository,
    QuestionTopicRepository,
    SubscriptionRepository,
    DocumentMessageRepository,
    OneTimeSubscriptionRepository,
    QuestionProgressRepository,
    PerformanceTrackingRepository,
    OralQuestionAnalysisRepository,
    CallCreditsRepository,
    FlaggedQuestionRepository,
    FlaggedDocumentMessageRepository,
  ],
})
export class InfraRepositoryModule {}
