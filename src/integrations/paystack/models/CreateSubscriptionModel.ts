export interface CreateSubscriptionPayloadModel {
  email: string;
  plan: string;
  userId: string
  startDate?: Date;
}

export interface CreateSubscriptionModel {
  redirectUrl: string;
  accessCode: string;
  reference: string;
}
