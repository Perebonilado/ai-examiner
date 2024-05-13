import { Module } from '@nestjs/common';
import { UserQueryService } from './services/UserQueryService';
import { CourseQueryService } from './services/CourseQueryService';
import { CourseDocumentQueryService } from './services/CourseDocumentQueryService';
import { QuestionQueryService } from './services/QuestionQueryService';

@Module({
  providers: [
    UserQueryService,
    CourseQueryService,
    CourseDocumentQueryService,
    QuestionQueryService,
  ],
  exports: [
    UserQueryService,
    CourseQueryService,
    CourseDocumentQueryService,
    QuestionQueryService,
  ],
})
export class QueryModule {}
