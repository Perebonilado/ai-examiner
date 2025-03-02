import { Call, Assistant, Artifact } from '@vapi-ai/server-sdk/api/types';

interface Message {
  role: 'assistant' | 'user';
  message: string;
}

export interface VapiCallEndedDto {
  message: {
    type: 'end-of-call-report';
    endedReason: string;
    call: Call;
    recordingUrl?: string;
    artifact: Artifact;
    summary?: string;
    transcript?: string;
    assistant: Assistant;
    messages?: Message[];
  };
}
