import { Injectable } from '@nestjs/common';
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

  public async update(user: UserModel) {
    try {
      await UserModel.update(user, {
        where: { id: user.id },
        fields: ['firstName', 'lastName', 'password', 'email', 'role'],
      });

      return await UserModel.findOne({ where: { id: user.id } });
    } catch (error) {
      console.log('db error =====>', error)
      throw new DatabaseError('Failed to update user').InnerError(error);
    }
  }

  public async deleteUser(userId: string) {
    try {
      return await UserModel.destroy({ where: { id: userId } });
    } catch (error) {
      throw new DatabaseError('Failed to delete user').InnerError(error);
    }
  }
}
