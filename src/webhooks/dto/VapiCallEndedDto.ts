import { Call, Assistant, Artifact } from '@vapi-ai/server-sdk/api/types';

interface Message {
  role: 'assistant' | 'user';
  message: string;
}

export interface VapiCallEndedDto {
  message: Message
}

interface Message {
  timestamp: number;
  type: string;
  analysis: {
    summary: string;
    successEvaluation: string;
  };
  artifact: {
    messages: any[];
    messagesOpenAIFormatted: any[];
    transcript: string;
    recordingUrl: string;
    stereoRecordingUrl: string;
  };
  startedAt: string;
  endedAt: string;
  endedReason: string;
  cost: number;
  costBreakdown: {
    stt: number;
    llm: number;
    tts: number;
    vapi: number;
    total: number;
    llmPromptTokens: number;
    llmCompletionTokens: number;
    ttsCharacters: number;
    analysisCostBreakdown: object;
  };
  costs: object[];
  durationMs: number;
  durationSeconds: number;
  durationMinutes: number;
  summary: string;
  transcript: string;
  messages: Message[];
  recordingUrl: string;
  stereoRecordingUrl: string;
  call: Call;
  assistant: Assistant;
}
