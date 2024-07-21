export interface SubscriptionDto {
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    metadata: {
      photos: {
        type: string;
        typeId: string;
        typeName: string;
        url: string;
        isPrimary: boolean;
      }[];
    };
    domain: string;
    customer_code: string;
    id: number;
    integration: number;
    createdAt: string;
    updatedAt: string;
  };
  plan: {
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
    integration: number;
    createdAt: string;
    updatedAt: string;
  };
  integration: number;
  authorization: {
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
  };
  domain: string;
  start: number;
  status: 'active' | 'non-renewing' | 'attention' | 'completed' | 'cancelled';
  quantity: number;
  amount: number;
  subscription_code: string;
  email_token: string;
  easy_cron_id: string | null;
  cron_expression: string;
  next_payment_date: string;
  open_invoice: string | null;
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListSubscriptionDto {
  status: boolean;
  message: string;
  data: SubscriptionDto[];
}

export interface FetchSubscriptionDto {
  status: boolean;
  message: string;
  data: {
    invoices: any[];
    customer: {
      first_name: string;
      last_name: string;
      email: string;
      phone: string | null;
      metadata: {
        photos: {
          type: string;
          typeId: string;
          typeName: string;
          url: string;
          isPrimary: boolean;
        }[];
      };
      domain: string;
      customer_code: string;
      id: number;
      integration: number;
      createdAt: string;
      updatedAt: string;
    };
    plan: {
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
      integration: number;
      createdAt: string;
      updatedAt: string;
    };
    integration: number;
    authorization: {
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
    };
    domain: string;
    start: number;
    status: 'active' | 'non-renewing' | 'attention' | 'completed' | 'cancelled';
    quantity: number;
    amount: number;
    subscription_code: string;
    email_token: string;
    easy_cron_id: string | null;
    cron_expression: string;
    next_payment_date: string;
    open_invoice: string | null;
    id: number;
    createdAt: string;
    updatedAt: string;
  };
}
