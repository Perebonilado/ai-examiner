export enum FlodeskSubscriberStatus {
  Active = 'active',
  Unsubscribed = 'unsubscribed',
  Unconfirmed = 'unconfirmed',
  Bounced = 'bounced',
  Complained = 'complained',
  Cleaned = 'cleaned',
}

export interface FlodeskSubscriberModel {
  id: string;
  status: FlodeskSubscriberStatus;
  email: string;
  source: string;
  first_name: string;
  last_name: string;
  segments: {
    id: string;
    name: string;
  }[];
  custom_fields: Record<string, string>;
  optin_ip: string;
  optin_timestamp: string;
  created_at: string;
}
