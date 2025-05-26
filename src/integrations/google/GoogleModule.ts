import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { YoutubeService } from './services/YoutubeService';
import { GoogleDriveService } from './services/GoogleDriveService';
import { GoogleSearchService } from './services/GoogleSearchService';

@Module({
  imports: [HttpModule],
  providers: [YoutubeService, GoogleDriveService, GoogleSearchService],
  exports: [YoutubeService, GoogleDriveService, GoogleSearchService],
})
export class GoogleModule {}
