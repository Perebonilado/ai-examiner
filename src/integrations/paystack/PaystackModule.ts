import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PaystackSubscriptionService } from './services/PaystackSubscriptionService';
import { PaystackPlansService } from './services/PaystackPlansService';

@Module({
  imports: [HttpModule],
  providers: [PaystackSubscriptionService, PaystackPlansService],
  exports: [PaystackSubscriptionService, PaystackPlansService],
})
export class PaystackModule {}
