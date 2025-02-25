import { PlanInterval } from "../dto/ListPlanDto";

export interface ListPlansPayloadModel {
  page?: number;
  perPage?: number;
}

export interface PlanModel {
  planName: string;
  planId: string;
  currency: string;
  amount: number;
  interval: PlanInterval;
  description: string;
}
