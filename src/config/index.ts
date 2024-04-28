export interface Config {
  openAiApiKey: string;
  port: string
}

export default (): Config => ({
  openAiApiKey: process.env.OPEN_AI_API_KEY,
  port: process.env.PORT
});
