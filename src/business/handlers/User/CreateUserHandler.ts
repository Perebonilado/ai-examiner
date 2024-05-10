import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateUserRequest } from '../request/CreateUserRequest';
import { CreateUserResponse } from '../response/CreateUserResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { UserQueryService } from 'src/query/services/UserQueryService';
import { UserRepository } from 'src/business/repository/UserRepository';
import { UserModel } from 'src/infra/db/models/UserModel';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { hashPassword } from 'src/utils';

@Injectable()
export class CreateUserHandler extends AbstractRequestHandlerTemplate<
  CreateUserRequest,
  CreateUserResponse
> {
  constructor(
    @Inject(UserQueryService) private userQueryService: UserQueryService,
    @Inject(UserRepository) private userRepository: UserRepository,
    private jwtService: JwtService,
  ) {
    super();
  }

  public async handleRequest(
    request: CreateUserRequest,
  ): Promise<CommandResponse<CreateUserResponse>> {
    try {
      const userExists = await this.userQueryService.findOne(
        request.payload.email,
      );

      if (!userExists) {
        const payload = {...request.payload, password: await hashPassword(request.payload.password)}
        const savedUser = await this.userRepository.create(
          payload as UserModel,
        );

        const token = this.jwtService.sign(
          {
            sub: savedUser.id,
            email: savedUser.email,
          },
          { secret: EnvironmentVariables.config.jwtSecret },
        );

        return {
          message: 'User Created Successfully',
          data: {
            token,
          },
          status: HttpStatus.CREATED,
        };
      }

      throw new HttpException('User already exists', HttpStatus.BAD_REQUEST);
    } catch (error) {
      throw new HandlerError('Failed to handle user creation').InnerError(
        error,
      );
    }
  }
}
