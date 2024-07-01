export interface EnableSubscriptionModel {
  status: boolean;
}

export interface EnableSubscriptionPayloadModel {
  subscriptionCode: string;
  emailToken: string;
}
