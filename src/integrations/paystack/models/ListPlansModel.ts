export interface ListPlansPayloadModel {
  page?: number;
  perPage?: number;
}

export interface PlanModel {
  planName: string;
  planId: string;
  currency: string;
  amount: number;
  description: string;
}
