import { Module } from '@nestjs/common';
import { StorageBucketService } from './services/StorageBucketService';

@Module({
  providers: [StorageBucketService],
  exports: [StorageBucketService],
})
export class AwsModule {}
