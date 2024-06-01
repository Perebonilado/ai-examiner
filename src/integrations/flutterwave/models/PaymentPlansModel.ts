import { CurrencyType } from './CurrencyType';

export interface GetPaymentPlansQueryModel {
  currency: CurrencyType;
}

export interface PaymentPlanModel {
  id: number;
  name: string;
  amount: number;
  interval: string;
  duration: number;
  status: string;
  currency: string;
  plan_token: string;
  created_at: Date;
}

export interface GetPaymentPlansResponseModel {
  status: string;
  message: string;
  meta: {
    page_info: {
      total: number;
      current_page: number;
      total_pages: number;
    };
  };
  data: PaymentPlanModel[];
}
