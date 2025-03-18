import { Index, Pinecone, RecordMetadata } from '@pinecone-database/pinecone';
import { EnvironmentVariables } from 'src/EnvironmentVariables';

export class PineconeClient {
  constructor() {
    const client = new Pinecone({
      apiKey: EnvironmentVariables.config.pineconeApiKey,
    });

    this.client = client;

    this.index = client.index(this.indexName, this.indexHost);
  }

  protected client: Pinecone;

  protected index: Index<RecordMetadata>;

  protected indexName = 'ai-examiner-docs';

  protected documentsNameSpace = 'user_docs_namespace'

  protected indexHost =
    'https://ai-examiner-docs-t28dirx.svc.aped-4627-b74a.pinecone.io';
}
