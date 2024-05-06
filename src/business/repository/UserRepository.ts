import { UserModel } from 'src/infra/db/models/UserModel';

export const UserRepository = Symbol('UserRepository');

export interface UserRepository {
  create(user: UserModel): Promise<UserModel>;
}
