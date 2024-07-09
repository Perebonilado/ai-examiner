import { Module } from '@nestjs/common';
import { NotificationsGateway } from './services/NotificationsGateway';

@Module({
  providers: [NotificationsGateway],
  exports: [NotificationsGateway],
})
export class NotificationsModule {}
