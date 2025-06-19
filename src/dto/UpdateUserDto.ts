import { UserRole } from "src/infra/web/models/UserRole";

export interface UpdateUserDto {
  id: string;
  password: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole
}
