export interface Config {
  openAiApiKey: string;
  port: string;
  databasePort: number;
  databaseUsername: string;
  databasePassword: string;
  database: string;
  databaseHost: string;
  jwtSecret: string;
}

export default (): Config => ({
  openAiApiKey: process.env.OPEN_AI_API_KEY,
  port: process.env.PORT,
  databasePort: process.env.Database_Port as unknown as number,
  databaseUsername: process.env.Database_Username,
  databasePassword: process.env.Database_Password,
  database: process.env.Database,
  databaseHost: process.env.Database_Host,
  jwtSecret: process.env.JWT_SECRET
});
