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

@Module({
  imports: [
    JwtModule.register({
      global: true,
    }),
    IntegrationsModule,
    BusinessModule,
    QueryModule,
  ],
  providers: [AuthService, GoogleStrategy],
  controllers: [
    QuestionsController,
    AuthController,
    CourseController,
    CourseDocumentController,
    DocumentTopicController,
    FileUploadController
  ],
})
export class InfraWebModule {}
