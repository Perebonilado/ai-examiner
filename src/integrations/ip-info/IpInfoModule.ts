import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { IpInfoService } from './services/IpInfoService';

@Module({
  imports: [HttpModule],
  providers: [IpInfoService],
  exports: [IpInfoService],
})
export class IpInfoModule {}
