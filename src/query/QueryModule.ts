import { Module } from '@nestjs/common';
import { UserQueryService } from './services/UserQueryService';

@Module({
  providers: [UserQueryService],
  exports: [UserQueryService],
})
export class QueryModule {}
