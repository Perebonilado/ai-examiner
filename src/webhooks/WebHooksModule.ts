import { Module } from '@nestjs/common';
import { PaystackWebhook } from './web/PaystackWebHook';
import { BusinessModule } from 'src/business/BusinessModule';
import { QueryModule } from 'src/query/QueryModule';
import { NotificationsModule } from 'src/notification/NotificationsModule';

@Module({
  imports: [BusinessModule, QueryModule, NotificationsModule],
  controllers: [PaystackWebhook],
})
export class WebHooksModule {}
