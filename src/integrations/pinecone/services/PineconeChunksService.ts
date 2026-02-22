import { HttpException, HttpStatus, Injectable, Inject } from '@nestjs/common';
import { PineconeClient } from './PineconeClient';
import { IntegratedRecord, RecordMetadata } from '@pinecone-database/pinecone';

@Injectable()
export class PineconeChunkService extends PineconeClient {
  constructor() {
    super();
  }

  public async upsertChunks(
    chunks: string[],
    documentId: string,
    startIdx = 0,
  ) {
    try {
      const chunksToUpload: IntegratedRecord<RecordMetadata>[] = chunks.map(
        (chunk, idx) => {
          return {
            _id: `${documentId}#chunk${idx + startIdx}`,
            text: chunk,
            documentId,
          };
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
        error?.message ?? 'Failed to upsert chunks',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  public async chunkByIndexSearch(index: number, documentId: string) {
    try {
      const queryResponse = await this.index.namespace(this.documentsNameSpace).query({
        id:`${documentId}#chunk${index}`,
        topK: 1,
        includeMetadata: true,
        includeValues: false
      });;

      return queryResponse.matches[0]?.metadata['text'] as string
    } catch (error) {
      throw new HttpException('Failed to index search', HttpStatus.BAD_REQUEST);
    }
  }

  public async semanticChunkSearch(
    query: string,
    documentId: string,
    topK = 2,
  ) {
    try {
      const queryResponse = await this.index
        .namespace(this.documentsNameSpace)
        .searchRecords({
          query: {
            topK: topK,
            inputs: {
              text: query,
            },
            filter: { documentId },
          },
        });

      return queryResponse.result.hits.map((hit) => {
        return hit.fields['text'] as string;
      });
    } catch (error) {
      throw new HttpException(
        'Failed to perform semantic query',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
