import {
  Controller,
  Get,
  UseGuards,
  HttpException,
  HttpStatus,
  Inject,
  Req,
  Post,
} from '@nestjs/common';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { Request } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { UserQueryService } from 'src/query/services/UserQueryService';
import { DeleteUserDataHandler } from 'src/business/handlers/User/DeleteUserDataHandler';

@Controller('user')
export class UserController {
  constructor(
    @Inject(UserQueryService) private userQueryService: UserQueryService,
    @Inject(DeleteUserDataHandler)
    private deleteUserDataHandler: DeleteUserDataHandler,
  ) {}

  @UseGuards(AuthGuard)
  @Get('/profile')
  public async getUserProfileInformation(@Req() request: Request) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;

      const user = await this.userQueryService.findById(userToken.sub);

      return {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      };
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to get user profile information',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('/delete-user')
  public async deleteUserInformation(@Req() request: Request) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      return await this.deleteUserDataHandler.handle({ userId: userToken.sub });
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to delete user information',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
