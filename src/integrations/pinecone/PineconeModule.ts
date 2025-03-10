import { Module } from '@nestjs/common';
import { PineconeChunkService } from './services/PineconeChunksService';

@Module({
  providers: [PineconeChunkService],
  exports: [PineconeChunkService],
})
export class PineconeModule {}
