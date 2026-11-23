import { UserRole } from 'src/infra/web/models/UserRole';

export interface CreateUserDto {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role?: UserRole;
  /** Set by the server only (sign-ups by email start unconfirmed). */
  emailConfirmed?: boolean;
}
