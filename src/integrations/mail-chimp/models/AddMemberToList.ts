export interface AddMemberToListPayloadModel {
  email: string;
  firstName: string;
  lastName: string;
}

export interface AddMemberToListResponseModel {
  message: string;
  data: {
    email: string;
  };
}
