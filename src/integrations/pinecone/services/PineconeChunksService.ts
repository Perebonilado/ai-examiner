import { HttpException, HttpStatus, Injectable, Inject } from '@nestjs/common';
import { PineconeClient } from './PineconeClient';
import { IntegratedRecord, RecordMetadata } from '@pinecone-database/pinecone';

@Injectable()
export class PineconeChunkService extends PineconeClient {
  constructor() {
    super();
  }

  public async upsertChunks(chunks: string[], documentId: string) {
    try {
      const chunksToUpload: IntegratedRecord<RecordMetadata>[] = chunks.map(
        (chunk, idx) => {
          return { _id: `${documentId}#chunk${idx}`, text: chunk, documentId };
        },
      );
      await this.index
        .namespace(this.documentsNameSpace)
        .upsertRecords(chunksToUpload);
      // Wait for the upserted vectors to be indexed
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return await this.index.describeIndexStats();
    } catch (error) {
      throw new HttpException(
        error ?? 'Failed to upsert chunks',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  public async semanticChunkSearch(query: string, documentId: string) {
    try {
      const queryResponse = await this.index
        .namespace(this.documentsNameSpace)
        .searchRecords({
          query: {
            topK: 10,
            inputs: {
              text: query,
            },
            filter: { documentId },
          },
        });

      return queryResponse.result.hits
        .map((hit) => {
          return hit.fields['text'];
        })
        .join('\n');
    } catch (error) {
      throw new HttpException(
        'Failed to perform semantic query',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
