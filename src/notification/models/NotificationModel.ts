export interface NotificationModel {
  status: 'successful' | 'failed';
  message: string;
  data?: unknown;
}
