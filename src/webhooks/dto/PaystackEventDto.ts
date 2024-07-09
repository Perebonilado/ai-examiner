export interface PaystackEventDto {
  event: PaystackEvent;
  data: unknown;
}

export type PaystackEvent = 'subscription.disable' | 'charge.success';
