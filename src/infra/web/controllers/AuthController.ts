import {
  Controller,
  Post,
  Inject,
  HttpException,
  HttpStatus,
  Body,
  UsePipes,
  Get,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { CreateUserHandler } from 'src/business/handlers/User/CreateUserHandler';
import { CreateUserDto } from 'src/dto/CreateUserDto';
import { AuthService } from 'src/infra/auth/services/AuthService';
import { ZodValidationPipe } from 'src/pipes/ZodValidationPipe.pipe';
import { SignUpValidationSchema } from '../zod-validation-schemas/SignUpValidationSchema';
import { LoginUserDto } from 'src/dto/LoginUserDto';
import { LoginValidationSchema } from '../zod-validation-schemas/LoginValidationSchema';
import { GoogleOauthGuard } from 'src/infra/auth/guards/GoogleOauthGuard';
import { Request, Response } from 'express';
import { UserQueryService } from 'src/query/services/UserQueryService';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentVariables } from 'src/EnvironmentVariables';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(CreateUserHandler) private createUserHandler: CreateUserHandler,
    @Inject(AuthService) private authService: AuthService,
    @Inject(UserQueryService) private userQueryService: UserQueryService,
    private jwtService: JwtService,
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

  @Get('/google')
  @UseGuards(GoogleOauthGuard)
  public async googleAuth() {}

  @Get('/google/callback')
  @UseGuards(GoogleOauthGuard)
  public async googleAuthRedirect(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const { email, firstName, lastName } = req.user as {
        email: string;
        firstName: string;
        lastName: string;
      };
      const user = await this.userQueryService.findOne(email);

      if (user) {
        const token = this.jwtService.sign(
          {
            sub: user.id,
            email: user.email,
          },
          { secret: EnvironmentVariables.config.jwtSecret },
        );

        response.redirect(
          `${EnvironmentVariables.config.frontendBaseUrl}/auth/login?token=${token}`,
        );
        // response.cookie('access_token', token);
        // response.redirect(
        //   `${EnvironmentVariables.config.frontendBaseUrl}/dashboard`,
        // );
      } else {
        const createdUser = await this.createUserHandler.handle({
          payload: {
            email,
            firstName,
            lastName,
            password: '',
          },
        });

        response.redirect(
          `${EnvironmentVariables.config.frontendBaseUrl}/auth/login?token=${createdUser.data.token}`,
        );

        // response.cookie('access_token', createdUser.data.token);
        // response.redirect(
        //   `${EnvironmentVariables.config.frontendBaseUrl}/dashboard`,
        // );
      }
    } catch (error) {
      throw new HttpException(
        'google oauth login error',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
