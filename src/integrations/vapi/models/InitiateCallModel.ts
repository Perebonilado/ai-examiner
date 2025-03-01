export interface InitiateCallModel {
  userName: string;
  userPhoneNumber: string;
  messageContent: string;
  metadata: CallAssistantMetaData
}

interface CallAssistantMetaData {
  customerEmail: string;
  questionId: string;
}
