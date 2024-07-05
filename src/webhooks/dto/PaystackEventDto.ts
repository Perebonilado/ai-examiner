export interface PaystackEventDto {
  event: PaystackEvent;
  body: unknown;
}

export type PaystackEvent = 'subscription.create' | 'subscription.disable';
