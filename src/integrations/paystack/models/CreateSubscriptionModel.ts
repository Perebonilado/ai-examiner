
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


export interface CreateOneTimeSubscriptionPayloadModel {
  email: string;
  amount: string;
  planCode: string;
  currency: string
}