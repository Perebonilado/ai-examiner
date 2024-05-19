import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UserModel } from '../models/UserModel';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';

@Injectable()
export class UserDbConnector {
  public async create(user: UserModel) {
    try {
      return await UserModel.create(user);
    } catch (error) {
      throw new DatabaseError('Failed to create user').InnerError(error);
    }
  }
}
