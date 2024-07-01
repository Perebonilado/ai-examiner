export interface UpdateCardDto {
  status: boolean;
  message: string;
  data: {
    link: string;
  };
}
