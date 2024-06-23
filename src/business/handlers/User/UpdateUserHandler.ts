import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { UpdateUserRequest } from '../request/UpdateUserRequest';
import { UpdateUserResponse } from '../response/UpdateUserResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { UserRepository } from 'src/business/repository/UserRepository';
import { UserQueryService } from 'src/query/services/UserQueryService';
import { UserModel } from 'src/infra/db/models/UserModel';
import { hashPassword } from 'src/utils';

@Injectable()
export class UpdateUserHandler extends AbstractRequestHandlerTemplate<
  UpdateUserRequest,
  UpdateUserResponse
> {
  constructor(
    @Inject(UserRepository) private userRepository: UserRepository,
    @Inject(UserQueryService) private userQueryService: UserQueryService,
  ) {
    super();
  }

  public async handleRequest(
    request: UpdateUserRequest,
  ): Promise<CommandResponse<UpdateUserResponse>> {
    try {
      const { id, password } = request.payload;

      const user = await this.userQueryService.findById(id);

      if (!user) {
        throw new HttpException('User does not exist', HttpStatus.NOT_FOUND);
      }

      await this.userRepository.update({
        ...user.get({ plain: true }),
        password: await hashPassword(password),
      } as UserModel);

      return {
        data: { data: null },
        message: 'User updated succesfully',
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HandlerError('Failed to handle user update').InnerError(error);
    }
  }
}
