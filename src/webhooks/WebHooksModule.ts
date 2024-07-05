import { Module } from '@nestjs/common';
import { PaystackWebhook } from './web/PaystackWebHook';

@Module({
  controllers: [PaystackWebhook],
})
export class WebHooksModule {}
