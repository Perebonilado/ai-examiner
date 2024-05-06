import {
  Controller,
  Post,
  Inject,
  HttpException,
  HttpStatus,
  Body,
  UsePipes,
} from '@nestjs/common';
import { CreateUserHandler } from 'src/business/handlers/User/CreateUserHandler';
import { CreateUserDto } from 'src/dto/CreateUserDto';
import { AuthService } from 'src/infra/auth/services/AuthService';
import { ZodValidationPipe } from 'src/pipes/ZodValidationPipe.pipe';
import { SignUpValidationSchema } from '../zod-validation-schemas/SignUpValidationSchema';
import { LoginUserDto } from 'src/dto/LoginUserDto';
import { LoginValidationSchema } from '../zod-validation-schemas/LoginValidationSchema';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(CreateUserHandler) private createUserHandler: CreateUserHandler,
    @Inject(AuthService) private authService: AuthService,
  ) {}

  @Post('/sign-up')
  @UsePipes(new ZodValidationPipe(SignUpValidationSchema))
  public async signUp(@Body() body: CreateUserDto) {
    try {
      return await this.createUserHandler.handle({ payload: body });
    } catch (error) {
      throw new HttpException(
        error?._innerError ?? 'Failed to create new user',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('/login')
  @UsePipes(new ZodValidationPipe(LoginValidationSchema))
  public async login(@Body() body: LoginUserDto) {
    try {
      return await this.authService.signIn(body);
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to login user',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
