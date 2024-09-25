export interface CreateOneTimeSubscriptionRequest {
  planCode: string;
  userId: string;
  expiresOn: Date;
}
