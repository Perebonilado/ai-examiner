import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { YoutubeService } from './services/YoutubeService';
import { GoogleDriveService } from './services/GoogleDriveService';

@Module({
  imports: [HttpModule],
  providers: [YoutubeService, GoogleDriveService],
  exports: [YoutubeService, GoogleDriveService],
})
export class GoogleModule {}
