import {
  Controller,
  Get,
  UseGuards,
  HttpException,
  HttpStatus,
  Inject,
  Req,
} from '@nestjs/common';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { Request } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { UserQueryService } from 'src/query/services/UserQueryService';

@Controller('user')
export class UserController {
  constructor(
    @Inject(UserQueryService) private userQueryService: UserQueryService,
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
}
