import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PaystackSubscriptionService } from './services/PaystackSubscriptionService';

@Module({
  imports: [HttpModule],
  providers: [PaystackSubscriptionService],
  exports: [PaystackSubscriptionService],
})
export class PaystackModule {}
