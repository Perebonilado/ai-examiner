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
    DeleteUserDataHandler
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
    DeleteUserDataHandler
  ],
})
export class BusinessModule {}
