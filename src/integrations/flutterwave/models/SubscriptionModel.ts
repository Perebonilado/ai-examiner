import { MetaModel } from './MetaModel';

export interface SubscriptionQueryModel {
  email?: string;
  status?: SubscriptionStatus;
  plan?: number;
  page?: string;
}

export type SubscriptionStatus = 'active' | 'cancelled' | '';

interface SubscriptionModel {
  id: number;
  amount: number;
  customer: {
    id: number;
    customer_email: string;
  };
  plan: number;
  status: Omit<SubscriptionStatus, ''>;
  created_at: Date;
}

export interface RetrieveSubscriptionModel {
  status: string;
  message: string;
  meta: MetaModel;
  data: SubscriptionModel[];
}

export interface CancelSubscriptionResponse {
  status: string;
  message: string;
  data: {
    id: number;
    amount: number;
    customer: {
      id: number;
      customer_email: string;
    };
    plan: number;
    status: 'cancelled';
    created_at: Date;
  };
}

export interface CancelSubscriptionPayloadModel {
  subscriptionId: string;
}
