import { Inject } from '@nestjs/common';
import { UserRepository } from 'src/business/repository/UserRepository';
import { UserModel } from '../models/UserModel';
import RepositoryError from 'src/error-handlers/infra/RepositoryError';
import { UserDbConnector } from '../connectors/UserDbConnector';

export class UserSequelizeRepository implements UserRepository {
  constructor(@Inject(UserDbConnector) private dbConnector: UserDbConnector) {}

  public async create(user: UserModel): Promise<UserModel> {
    try {
      return await this.dbConnector.create(user);
    } catch (error) {
      throw new RepositoryError('Failed to create user').InnerError(error);
    }
  }
}
