import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { YoutubeSearchService } from './services/YoutubeSearchService';

@Module({
  imports: [HttpModule],
  providers: [YoutubeSearchService],
  exports: [YoutubeSearchService],
})
export class RapidModule {}
