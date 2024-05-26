import { Module } from '@nestjs/common';
import { ManageSubscriptions } from './services/ManageSubscriptions';
import { ManagePlans } from './services/ManagePlans';

@Module({
  providers: [ManageSubscriptions, ManagePlans],
  exports: [ManageSubscriptions, ManagePlans],
})
export class FlutterwaveModule {}
