import { CallAssistantMetaData } from './InitiateCallModel';

export interface CreateVapiAssistantPayloadModel {
  userName: string;
  messageContent: string;
  metadata: CallAssistantMetaData;
}

export interface CreateVapiAssistantModel {
  id: string;
}
