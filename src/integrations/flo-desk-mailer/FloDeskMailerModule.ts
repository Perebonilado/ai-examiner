import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FloDeskMailerService } from './services/FloDeskMailerService';

@Module({
  imports: [HttpModule],
  providers: [FloDeskMailerService],
  exports: [FloDeskMailerService],
})
export class FloDeskMailerModule {}
