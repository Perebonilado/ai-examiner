export interface Config {
  openAiApiKey: string;
  port: string;
  databasePort: number;
  databaseUsername: string;
  databasePassword: string;
  database: string;
  databaseHost: string;
  jwtSecret: string;
  assistantIdFreePlan: string;
  assistantIdPaidPlan: string;
  googleClientId: string;
  googleClientSecret: string;
  googleCallbackUrl: string;
  frontendBaseUrl: string;
  frontendAccessTokenKey: string;
  mailChimpApiKey: string;
  mailChimpServerPrefix: string;
  mailChimpAudienceId: string;
  floDeskBaseUrl: string;
  floDeskApiKey: string;
  flutterwaveSecretKey: string;
  paystackSecretKey: string;
  emailUser: string;
  emailPass: string;
  emailHost: string;
  ipStackApiKey: string;
  ipInfoToken: string;
  iLovePdfPublicKey: string;
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
  floDeskBaseUrl: process.env.FLO_DESK_BASE_URL,
  floDeskApiKey: process.env.FLO_DESK_API_KEY,
  assistantIdFreePlan: process.env.OPEN_AI_ASSITANT_ID_FREE_PLAN,
  assistantIdPaidPlan: process.env.OPEN_AI_ASSITANT_ID_PAID_PLAN,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL,
  frontendBaseUrl: process.env.FRONTEND_BASE_URL,
  frontendAccessTokenKey: process.env.FRONTEND_ACCESS_TOKEN_KEY,
  mailChimpApiKey: process.env.MAILCHIMP_API_KEY,
  mailChimpServerPrefix: process.env.MAILCHIMP_SERVER_PREFIX,
  mailChimpAudienceId: process.env.MAILCHIMP_AUDIENCE_ID,
  flutterwaveSecretKey: process.env.FLUTTERWAVE_SECRET_KEY,
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY,
  emailPass: process.env.Email_pass,
  emailUser: process.env.Email_user,
  emailHost: process.env.Email_host,
  ipStackApiKey: process.env.IP_STACK_API_KEY,
  ipInfoToken: process.env.IP_INFO_TOKEN,
  iLovePdfPublicKey: process.env.ILOVEPDF_PUBLIC_KEY,
});
