import { CallAssistantMetaData } from './InitiateCallModel';

export interface CreateVapiAssistantPayloadModel {
  userName: string;
  messageContent: string;
  metadata: CallAssistantMetaData;
  maxDurationMs: number;
  language?: string
}

export interface CreateVapiAssistantModel {
  id: string;
}
