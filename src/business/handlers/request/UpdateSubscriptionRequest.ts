import { ChargeSuccessEventDto } from "src/webhooks/dto/ChargeSuccessDto";

export interface UpdateSubscriptionRequest {
  payload: {
    subscriptionData: ChargeSuccessEventDto<any>;
    userId: string;
  };
}
