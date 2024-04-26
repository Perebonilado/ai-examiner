export interface Config {
  openAiApiKey: string;
}

export default (): Config => ({
  openAiApiKey: process.env.OPEN_AI_API_KEY,
});
