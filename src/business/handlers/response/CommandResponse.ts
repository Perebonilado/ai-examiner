import { HttpStatus } from "@nestjs/common";

export interface CommandResponse<T> {
  message: string;
  data: T;
  status: HttpStatus
}
