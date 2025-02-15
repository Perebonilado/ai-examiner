import { Module } from '@nestjs/common';
import { IntegrationsModule } from 'src/integrations/IntegrationsModule';
import { QuestionsController } from './controllers/QuestionsController';
import { AuthController } from './controllers/AuthController';
import { BusinessModule } from 'src/business/BusinessModule';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from '../auth/services/AuthService';
import { QueryModule } from 'src/query/QueryModule';
import { CourseController } from './controllers/CourseController';
import { CourseDocumentController } from './controllers/CourseDocumentController';
import { GoogleStrategy } from '../auth/strategies/google.strategy';
import { DocumentTopicController } from './controllers/DocumentTopicController';
import { FileUploadController } from './controllers/FileUploadController';
import { LookUpController } from './controllers/LookUpController';
import { SubscriptionController } from './controllers/SubscriptionController';
import { PlanController } from './controllers/PlanController';
import { UserController } from './controllers/UserController';
import { PermissionController } from './controllers/PermissionController';
import { DocumentMessageController } from './controllers/DocumentMessageController';
import { QuestionProgressController } from './controllers/QuestionProgressController';
import { SpeechController } from './controllers/SpeechController';
import { PerformanceTrackingController } from './controllers/PerformanceTrackingController';
import { GoogleAuthService } from '../auth/services/GoogleAuthService';
import { GoogleAuthWebService } from '../auth/services/GoogleAuthWebService';

@Module({
  imports: [
    JwtModule.register({
      global: true,
    }),
    IntegrationsModule,
    BusinessModule,
    QueryModule,
  ],
  providers: [AuthService, GoogleStrategy, GoogleAuthService, GoogleAuthWebService],
  controllers: [
    QuestionsController,
    AuthController,
    CourseController,
    CourseDocumentController,
    DocumentTopicController,
    FileUploadController,
    LookUpController,
    SubscriptionController,
    PlanController,
    UserController,
    PermissionController,
    DocumentMessageController,
    QuestionProgressController,
    SpeechController,
    PerformanceTrackingController,
  ],
})
export class InfraWebModule {}
