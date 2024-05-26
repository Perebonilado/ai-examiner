import { CurrencyType } from './CurrencyType';

export interface CreateStandardPaymentModel {
  txRef: string;
  amount: string;
  currency: CurrencyType;
  redirectUrl: string;
  customer: {
    email: string;
    name: string;
  };
  paymentPlan: string;
}

export interface CreateStandardPaymentResponseModel {
  status: string;
  message: string;
  data: {
    link: string;
  };
}
