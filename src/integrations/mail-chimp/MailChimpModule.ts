import { Module } from '@nestjs/common';
import { ManageMailChimpAudience } from './services/ManageMailChimpAudience';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [ManageMailChimpAudience],
  exports: [ManageMailChimpAudience],
})
export class MailChimpModule {}
