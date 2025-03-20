import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PaystackSubscriptionService } from './services/PaystackSubscriptionService';
import { PaystackPlansService } from './services/PaystackPlansService';
import { PaystackCallCreditsService } from './services/PaystackCallCreditsService';

@Module({
  imports: [HttpModule],
  providers: [
    PaystackSubscriptionService,
    PaystackPlansService,
    PaystackCallCreditsService,
  ],
  exports: [
    PaystackSubscriptionService,
    PaystackPlansService,
    PaystackCallCreditsService,
  ],
})
export class PaystackModule {}
