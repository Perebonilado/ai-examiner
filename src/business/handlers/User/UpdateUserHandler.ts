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
import { JwtService } from '@nestjs/jwt';
import { EnvironmentVariables } from 'src/EnvironmentVariables';

@Injectable()
export class UpdateUserHandler extends AbstractRequestHandlerTemplate<
  UpdateUserRequest,
  UpdateUserResponse
> {
  constructor(
    @Inject(UserRepository) private userRepository: UserRepository,
    @Inject(UserQueryService) private userQueryService: UserQueryService,
    private jwtService: JwtService,
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
        firstName: request.payload?.firstName ?? user.firstName,
        lastName: request.payload?.lastName ?? user.lastName,
        email: request.payload?.email ?? user.email,
        role: request.payload?.role ?? user.role
      } as UserModel);

      const token = this.jwtService.sign(
        {
          sub: user.id,
          email: user.email,
        },
        { secret: EnvironmentVariables.config.jwtSecret },
      );

      return {
        data: { data: null, token },
        message: 'User updated succesfully',
        status: HttpStatus.OK,
      };
    } catch (error) {
      throw new HandlerError('Failed to handle user update').InnerError(error);
    }
  }
}
