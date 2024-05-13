import { Inject, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { LookUpModel } from 'src/infra/db/models/LookUpModel';
import { UserModel } from 'src/infra/db/models/UserModel';

@Injectable()
export class UserQueryService {
  constructor() {}

  async findAll(): Promise<UserModel[]> {
    try {
      return await UserModel.findAll();
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve users: ${error.message}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async findOne(email: string) {
    try {
      return await UserModel.findOne({ where: { email } });
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve user: ${error.message}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  public async findById(id: string) {
    try {
      return await UserModel.findOne({ where: { id }, include: [LookUpModel] });
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve user by id, ${id}: ${error.message}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
