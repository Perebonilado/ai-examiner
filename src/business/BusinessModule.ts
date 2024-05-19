import { Module } from '@nestjs/common';
import { CreateUserHandler } from './handlers/User/CreateUserHandler';
import { QueryModule } from 'src/query/QueryModule';
import { InfraRepositoryModule } from 'src/infra/db/InfraRepositoryModule';
import { IntegrationsModule } from 'src/integrations/IntegrationsModule';
import { CreateCourseHandler } from './handlers/Course/CreateCourseHandler';
import { CreateCourseDocumentHandler } from './handlers/CourseDocument/CreateCourseDocumentHandler';
import { CreateQuestionHandler } from './handlers/Question/CreateQuestionHandler';
import { CreateScoreHandler } from './handlers/Score/CreateScoreHandler';

@Module({
  imports: [QueryModule, InfraRepositoryModule, IntegrationsModule],
  providers: [
    CreateUserHandler,
    CreateCourseHandler,
    CreateCourseDocumentHandler,
    CreateQuestionHandler,
    CreateScoreHandler
  ],
  exports: [
    CreateUserHandler,
    CreateCourseHandler,
    CreateCourseDocumentHandler,
    CreateQuestionHandler,
    CreateScoreHandler
  ],
})
export class BusinessModule {}
