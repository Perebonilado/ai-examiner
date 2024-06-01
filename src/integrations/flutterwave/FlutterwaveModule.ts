import { Module } from '@nestjs/common';
import { ManageSubscriptions } from './services/ManageSubscriptions';
import { ManagePlans } from './services/ManagePlans';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [ManageSubscriptions, ManagePlans],
  exports: [ManageSubscriptions, ManagePlans],
})
export class FlutterwaveModule {}
