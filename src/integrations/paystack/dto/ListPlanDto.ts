export interface Plan {
  subscriptions: Subscription[];
  integration: number;
  domain: string;
  name: string;
  plan_code: string;
  description: string | null;
  amount: number;
  interval: string;
  send_invoices: boolean;
  send_sms: boolean;
  hosted_page: boolean;
  hosted_page_url: string | null;
  hosted_page_summary: string | null;
  currency: string;
  id: number;
  createdAt: string;
  updatedAt: string;
}

interface Subscription {
  customer: number;
  plan: number;
  integration: number;
  domain: string;
  start: number;
  status: string;
  quantity: number;
  amount: number;
  subscription_code: string;
  email_token: string;
  authorization: Authorization;
  easy_cron_id: number | null;
  cron_expression: string;
  next_payment_date: string;
  open_invoice: number | null;
  id: number;
  createdAt: string;
  updatedAt: string;
}

interface Authorization {
  authorization_code: string;
  bin: string;
  last4: string;
  exp_month: string;
  exp_year: string;
  channel: string;
  card_type: string;
  bank: string;
  country_code: string;
  brand: string;
  reusable: boolean;
  signature: string;
  account_name: string;
}

export interface PlanDto {
  status: boolean;
  message: string;
  data: Plan[];
  meta: {
    total: number;
    skipped: number;
    perPage: number;
    page: number;
    pageCount: number;
  };
}
