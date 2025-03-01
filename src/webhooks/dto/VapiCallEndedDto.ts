import { Call } from '@vapi-ai/server-sdk/api/types';

interface Message {
  role: 'assistant' | 'user';
  message: string;
}

export interface VapiCallEndedDto {
  type: 'end-of-call-report';
  endedReason: 'hangup' | 'hang';
  call: Call; 
  recordingUrl?: string;
  summary?: string;
  transcript?: string;
  messages?: Message[];
}
