export interface GetSubscriptionModel {
  cardInformation: {
    last4: string;
    brand: string;
    accountName: string;
    bank: string;
    expirationYear: string;
    expirationMonth: string;
  };
  planInformation: {
    name: string;
    planCode: string;
    amount: number;
    currency: string;
  };
  subscrptionInformation: {
    code: string;
    token: string;
    status: 'active' | 'non-renewing' | 'attention' | 'completed' | 'cancelled';
  }
}
