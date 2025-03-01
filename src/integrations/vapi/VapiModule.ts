import { Module } from '@nestjs/common';
import { VapiCallingService } from './services/VapiCallingService';

@Module({
  providers: [VapiCallingService],
  exports: [VapiCallingService],
})
export class VapiModule {}
