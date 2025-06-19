import {
  Controller,
  Get,
  UseGuards,
  HttpException,
  HttpStatus,
  Inject,
  Req,
  Post,
  Body,
} from '@nestjs/common';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { Request } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { UserQueryService } from 'src/query/services/UserQueryService';
import { DeleteUserDataHandler } from 'src/business/handlers/User/DeleteUserDataHandler';
import { CreateUserDto } from 'src/dto/CreateUserDto';
import { UpdateUserHandler } from 'src/business/handlers/User/UpdateUserHandler';
import { UserRole } from '../models/UserRole';
import { FloDeskMailerService } from 'src/integrations/flo-desk-mailer/services/FloDeskMailerService';
import { FloDeskSegments } from 'src/constants';

@Controller('user')
export class UserController {
  constructor(
    @Inject(UserQueryService) private userQueryService: UserQueryService,
    @Inject(DeleteUserDataHandler)
    private deleteUserDataHandler: DeleteUserDataHandler,
    @Inject(UpdateUserHandler) private updateUserHandler: UpdateUserHandler,
    @Inject(FloDeskMailerService)
    private floDeskMailerService: FloDeskMailerService,
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
        role: user.role,
      };
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to get user profile information',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('/upgrade-guest-account')
  public async upgradeGuestAccount(
    @Body() body: CreateUserDto,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const existingGuestAccount = await this.userQueryService.findById(
        userToken.sub,
      );

      if (!existingGuestAccount) {
        throw new HttpException(
          'Guest account does not exist',
          HttpStatus.BAD_REQUEST,
        );
      }

      const updatedUserInfo = await this.updateUserHandler.handle({
        payload: {
          id: existingGuestAccount.id,
          password: body.password,
          email: body.email,
          firstName: body.firstName,
          lastName: body.lastName,
          role: UserRole.User,
        },
      });

      await this.floDeskMailerService.createSubscriber({
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        segment_ids: [FloDeskSegments.newSubscribers.id],
      });

      return updatedUserInfo;
    } catch (error) {
      console.log(error)
      throw new HttpException(
        error?.response ?? 'Failed to upgrade guest account',
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
