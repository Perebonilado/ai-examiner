import { FloDeskSegmentModel } from './FloDeskSegmentModel';

export interface CreateFloDeskSubscriberPayload {
  email: string;
  firstName: string;
  lastName: string;
  segment_ids?: string[];
}
