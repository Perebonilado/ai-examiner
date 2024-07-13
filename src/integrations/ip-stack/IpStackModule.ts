import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IpStackIpDetailsService } from './services/IpStackIpDetailsService';

@Module({
  imports: [HttpModule],
  providers: [IpStackIpDetailsService],
  exports: [IpStackIpDetailsService],
})
export class IpStackModule {}
