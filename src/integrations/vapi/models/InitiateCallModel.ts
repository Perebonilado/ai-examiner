export interface InitiateCallModel {
  userName: string;
  userPhoneNumber: string;
  messageContent: string;
  metadata: CallAssistantMetaData
}

export interface CallAssistantMetaData {
  customerEmail: string;
  questionId: string;
}
