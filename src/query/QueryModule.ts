import { Module } from '@nestjs/common';
import { UserQueryService } from './services/UserQueryService';
import { CourseQueryService } from './services/CourseQueryService';
import { CourseDocumentQueryService } from './services/CourseDocumentQueryService';
import { QuestionQueryService } from './services/QuestionQueryService';
import { ScoreQueryService } from './services/ScoreQueryService';
import { DocumentTopicQueryService } from './services/DocumentTopicQueryService';

@Module({
  providers: [
    UserQueryService,
    CourseQueryService,
    CourseDocumentQueryService,
    QuestionQueryService,
    ScoreQueryService,
    DocumentTopicQueryService
  ],
  exports: [
    UserQueryService,
    CourseQueryService,
    CourseDocumentQueryService,
    QuestionQueryService,
    ScoreQueryService,
    DocumentTopicQueryService
  ],
})
export class QueryModule {}
