import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PineconeClient } from './PineconeClient';
import {
  Errors,
  IntegratedRecord,
  RecordMetadata,
} from '@pinecone-database/pinecone';

const RERANK_MODEL = 'bge-reranker-v2-m3';

@Injectable()
export class PineconeChunkService extends PineconeClient {
  private readonly logger = new Logger(PineconeChunkService.name);
  /** Turned off for this process if the index rejects reranking (no retrying a request that can't work). */
  private rerankAvailable = true;

  constructor() {
    super();
  }

  /**
   * The best `topN` passages for a question: takes twice as many candidates by meaning, then
   * reranks them against the question. Falls back to the plain search if reranking fails.
   */
  public async searchPassages(query: string, documentId: string, topN = 8) {
    if (this.rerankAvailable) {
      try {
        const response = await this.index
          .namespace(this.documentsNameSpace)
          .searchRecords({
            query: {
              topK: topN * 2,
              inputs: { text: query },
              filter: { documentId },
            },
            fields: ['text'],
            rerank: {
              model: RERANK_MODEL,
              rankFields: ['text'],
              topN,
              // Pages can be longer than the reranker's input; rank on their start.
              parameters: { truncate: 'END' },
            },
          });
        return response.result.hits.map((hit) => hit.fields['text'] as string);
      } catch (error) {
        const permanent =
          error instanceof Errors.PineconeBadRequestError ||
          error instanceof Errors.PineconeNotFoundError ||
          error instanceof Errors.PineconeAuthorizationError;
        if (permanent) this.rerankAvailable = false;
        this.logger.warn(
          `Rerank failed (${permanent ? 'turned off' : 'once'}): ${error?.message ?? error}`,
        );
      }
    }
    return this.semanticChunkSearch(query, documentId, topN);
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
