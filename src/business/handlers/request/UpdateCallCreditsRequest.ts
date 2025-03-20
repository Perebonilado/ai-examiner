export interface UpdateCallCreditsRequest {
  timeToUpdate: number;
  action: 'add_reamining_time' | 'subtract_remaining_time';
  userId: string;
}
