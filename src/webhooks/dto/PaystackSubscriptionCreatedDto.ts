export interface PaystackSubscriptionCreatedDto {
  domain: string;
  status: string;
  subscription_code: string;
  amount: number;
  cron_expression: string;
  next_payment_date: string;
  open_invoice: null | string;
  createdAt: string;
  plan: {
    name: string;
    plan_code: string;
    description: null | string;
    amount: number;
    interval: string;
    send_invoices: boolean;
    send_sms: boolean;
    currency: string;
  };
  authorization: {
    authorization_code: string;
    bin: string;
    last4: string;
    exp_month: string;
    exp_year: string;
    card_type: string;
    bank: string;
    country_code: string;
    brand: string;
    account_name: string;
  };
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    customer_code: string;
    phone: string;
    metadata: Record<string, unknown>;
    risk_action: string;
  };
  created_at: string;
}
