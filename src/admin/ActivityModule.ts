import { Global, Module } from '@nestjs/common';
import { ActivityService } from './services/ActivityService';

/** Makes ActivityService injectable everywhere, so any controller or handler can record activity. */
@Global()
@Module({
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
