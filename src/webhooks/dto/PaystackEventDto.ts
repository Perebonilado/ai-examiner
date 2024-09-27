export interface PaystackEventDto {
  event: PaystackEvent;
  data: any
}

export type PaystackEvent = 'subscription.disable' | 'charge.success';
