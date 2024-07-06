import { PaystackSubscriptionCreatedDto } from "src/webhooks/dto/PaystackSubscriptionCreatedDto";

export interface UpdateSubscriptionRequest {
  payload: {
    subscriptionData: PaystackSubscriptionCreatedDto;
    userId: string;
  };
}
