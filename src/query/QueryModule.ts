import { Module } from '@nestjs/common';
import { UserQueryService } from './services/UserQueryService';
import { CourseQueryService } from './services/CourseQueryService';

@Module({
  providers: [UserQueryService, CourseQueryService],
  exports: [UserQueryService, CourseQueryService],
})
export class QueryModule {}
