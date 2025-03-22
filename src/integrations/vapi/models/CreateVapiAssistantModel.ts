import { CallAssistantMetaData } from './InitiateCallModel';

export interface CreateVapiAssistantPayloadModel {
  userName: string;
  messageContent: string;
  metadata: CallAssistantMetaData;
  maxDurationMs: number;
}

export interface CreateVapiAssistantModel {
  id: string;
}
