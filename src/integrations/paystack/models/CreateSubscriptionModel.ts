export interface CreateSubscriptionPayloadModel {
  email: string;
  plan: string;
  startDate?: Date;
}

export interface CreateSubscriptionModel {
  redirectUrl: string;
  accessCode: string;
  reference: string;
}
