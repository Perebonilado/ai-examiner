export interface ListPlansPayloadModel {
  page?: number;
  perPage?: number;
}

export interface PlanModel {
  planName: string;
  planId: number;
  currency: string;
  amount: number;
  description: string;
}
