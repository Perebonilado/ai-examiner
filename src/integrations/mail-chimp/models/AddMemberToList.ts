export interface AddMemberToListPayloadModel {
  email: string;
}

export interface AddMemberToListResponseModel {
  message: string;
  data: {
    email: string;
  };
}
