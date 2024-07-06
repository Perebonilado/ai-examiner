import { PaystackSubscriptionCreatedDto } from 'src/webhooks/dto/PaystackSubscriptionCreatedDto';

export interface CreateSubscriptionRequest {
  payload: {
    subscriptionData: PaystackSubscriptionCreatedDto;
    userId: string;
  };
}
