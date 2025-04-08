import { Module } from '@nestjs/common';
import { CreateUserHandler } from './handlers/User/CreateUserHandler';
import { QueryModule } from 'src/query/QueryModule';
import { InfraRepositoryModule } from 'src/infra/db/InfraRepositoryModule';
import { IntegrationsModule } from 'src/integrations/IntegrationsModule';
import { CreateCourseHandler } from './handlers/Course/CreateCourseHandler';
import { CreateCourseDocumentHandler } from './handlers/CourseDocument/CreateCourseDocumentHandler';
import { CreateQuestionHandler } from './handlers/Question/CreateQuestionHandler';
import { CreateScoreHandler } from './handlers/Score/CreateScoreHandler';
import { UpdateScoreHandler } from './handlers/Score/UpdateScoreHandler';
import { CreateDocumentTopicHandler } from './handlers/DocumentTopic/CreateDocumentTopicHandler';
import { DeleteDocumentTopicHandler } from './handlers/DocumentTopic/DeleteDocumentTopicHandler';
import { CreateQuestionTopicHandler } from './handlers/QuestionTopic/CreateQuestionTopicHandler';
import { UpdateUserHandler } from './handlers/User/UpdateUserHandler';
import { CreateSubscriptionHandler } from './handlers/Subscription/CreateSubscriptionHandler';
import { UpdateSubscriptionHandler } from './handlers/Subscription/UpdateSubscriptionHandler';
import { CreateDocumentMessageHandler } from './handlers/DocumentMessage/CreateDocumentMessageHandler';
import { DeleteScoreHandler } from './handlers/Score/DeleteScoreHandler';
import { DeleteQuestionTopicHandler } from './handlers/QuestionTopic/DeleteQuestionTopicHandler';
import { DeleteQuestionHandler } from './handlers/Question/DeleteQuestionHandler';
import { CreateOneTimeSubscriptionHandler } from './handlers/OneTimeSubscription/CreateOneTimeSubscriptionHandler';
import { UpdateOneTimeSubscriptionHandler } from './handlers/OneTimeSubscription/UpdateOneTimeSubscriptionHandler';
import { UpserQuestionProgressHandler } from './handlers/QuestionProgress/UpsertQuestionProgressHandler';
import { UpdateCourseDocumentHandler } from './handlers/CourseDocument/UpdateCourseDocumentHandler';
import { CreatePerformanceTrackingHandler } from './handlers/PerformanceTracking/CreatePerformanceTrackingHandler';
import { DeleteUserDataHandler } from './handlers/User/DeleteUserDataHandler';
import { CreateOralQuestionAnalysisHandler } from './handlers/OralQuestionAnalysis/CreateOralQuestionAnalysisHandler';
import { CreateCallCreditsHandler } from './handlers/CallCredits/CreateCallCreditsHandler';
import { UpdateCallCreditsHandler } from './handlers/CallCredits/UpdateCallCreditsHandler';
import { CreateFlaggedQuestionHandler } from './handlers/FlaggedQuestion/CreateFlaggedQuestionHandler';
import { CreateFlaggedMessageHandler } from './handlers/FlaggedDocumentMessage/CreateFlaggedDocumentMessageHandler';
import { CreatePreferredLanguageHandler } from './handlers/PreferredLanguage/CreatePreferredLanguageHandler';
import { UpdatePreferredLanguageHandler } from './handlers/PreferredLanguage/UpdatePreferredLanguageHandler';
import { UpdateEssayQuestionAnalysisHandler } from './handlers/EssayQuestionAnalysis/UpdateEssayQuestionAnalysisHandler';
import { CreateEssayQuestionAnalysisHandler } from './handlers/EssayQuestionAnalysis/CreateEssayQuestionAnalysisHandler';

@Module({
  imports: [QueryModule, InfraRepositoryModule, IntegrationsModule],
  providers: [
    CreateUserHandler,
    CreateCourseHandler,
    CreateCourseDocumentHandler,
    CreateQuestionHandler,
    CreateScoreHandler,
    UpdateScoreHandler,
    CreateDocumentTopicHandler,
    DeleteDocumentTopicHandler,
    CreateQuestionTopicHandler,
    UpdateUserHandler,
    CreateSubscriptionHandler,
    UpdateSubscriptionHandler,
    CreateDocumentMessageHandler,
    DeleteScoreHandler,
    DeleteQuestionTopicHandler,
    DeleteQuestionHandler,
    CreateOneTimeSubscriptionHandler,
    UpdateOneTimeSubscriptionHandler,
    UpserQuestionProgressHandler,
    UpdateCourseDocumentHandler,
    CreatePerformanceTrackingHandler,
    DeleteUserDataHandler,
    CreateOralQuestionAnalysisHandler,
    CreateCallCreditsHandler,
    UpdateCallCreditsHandler,
    CreateFlaggedQuestionHandler,
    CreateFlaggedMessageHandler,
    CreatePreferredLanguageHandler,
    UpdatePreferredLanguageHandler,
    UpdateEssayQuestionAnalysisHandler,
    CreateEssayQuestionAnalysisHandler,
  ],
  exports: [
    CreateUserHandler,
    CreateCourseHandler,
    CreateCourseDocumentHandler,
    CreateQuestionHandler,
    CreateScoreHandler,
    UpdateScoreHandler,
    CreateDocumentTopicHandler,
    DeleteDocumentTopicHandler,
    CreateQuestionTopicHandler,
    UpdateUserHandler,
    CreateSubscriptionHandler,
    UpdateSubscriptionHandler,
    CreateDocumentMessageHandler,
    DeleteScoreHandler,
    DeleteQuestionTopicHandler,
    DeleteQuestionHandler,
    CreateOneTimeSubscriptionHandler,
    UpdateOneTimeSubscriptionHandler,
    UpserQuestionProgressHandler,
    UpdateCourseDocumentHandler,
    CreatePerformanceTrackingHandler,
    DeleteUserDataHandler,
    CreateOralQuestionAnalysisHandler,
    CreateCallCreditsHandler,
    UpdateCallCreditsHandler,
    CreateFlaggedQuestionHandler,
    CreateFlaggedMessageHandler,
    CreatePreferredLanguageHandler,
    UpdatePreferredLanguageHandler,
    UpdateEssayQuestionAnalysisHandler,
    CreateEssayQuestionAnalysisHandler,
  ],
})
export class BusinessModule {}
