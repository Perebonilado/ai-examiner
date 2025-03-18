import { Mistral } from '@mistralai/mistralai';
import { EnvironmentVariables } from 'src/EnvironmentVariables';

export class MistralClient {
  constructor() {
    this.client = new Mistral({
      apiKey: EnvironmentVariables.config.mistralApiKey,
    });
  }

  protected client: Mistral;
}
