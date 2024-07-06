import { Module } from '@nestjs/common';
import { PaystackWebhook } from './web/PaystackWebHook';
import { BusinessModule } from 'src/business/BusinessModule';
import { QueryModule } from 'src/query/QueryModule';

@Module({
  imports: [BusinessModule, QueryModule],
  controllers: [PaystackWebhook],
})
export class WebHooksModule {}
