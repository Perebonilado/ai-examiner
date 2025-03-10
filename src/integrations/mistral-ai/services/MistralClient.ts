import { Mistral } from '@mistralai/mistralai';

export class MistralClient {
  constructor() {
    this.client = new Mistral({ apiKey: '' });
  }

  protected client: Mistral;
}
