export interface CreateCallCreditsPaymentModel {
  email: string;
  amount: string;
  currency: 'USD' | 'NGN';
  timePurchasedMs: number;
}
