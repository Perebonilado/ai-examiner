export interface Config {
  openAiApiKey: string;
  port: string;
  databasePort: number;
  databaseUsername: string;
  databasePassword: string;
  database: string;
  databaseHost: string;
  jwtSecret: string;
  assistantId: string;
  awsAccessKey: string;
  awsSecretKey: string;
  awsStorageBucket: string;
  awsServerLocation: string;
}

export default (): Config => ({
  openAiApiKey: process.env.OPEN_AI_API_KEY,
  port: process.env.PORT,
  databasePort: process.env.Database_Port as unknown as number,
  databaseUsername: process.env.Database_Username,
  databasePassword: process.env.Database_Password,
  database: process.env.Database,
  databaseHost: process.env.Database_Host,
  jwtSecret: process.env.JWT_SECRET,
  awsAccessKey: process.env.Aws_Access_Key,
  awsSecretKey: process.env.Aws_Secret_Key,
  awsStorageBucket: process.env.Aws_Storage_Bucket,
  awsServerLocation: process.env.Aws_Server_Location,
  assistantId: process.env.OPEN_AI_ASSITANT_ID
});
