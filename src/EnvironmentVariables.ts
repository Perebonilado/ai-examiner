import envConfig, { Config } from './config';

export class EnvironmentVariables {
  public static get config(): Config {
    return envConfig();
  }
}
