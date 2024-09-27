import { ChargeSuccessEventDto } from 'src/webhooks/dto/ChargeSuccessDto';

export interface CreateSubscriptionRequest {
  payload: {
    subscriptionData: ChargeSuccessEventDto<any>;
    userId: string;
  };
}
