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
import { ForgotPasswordDto } from 'src/dto/ForgotPasswordDto';
import { ForgotPasswordValidationSchema } from '../zod-validation-schemas/ForgotPasswordValidationSchema';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { MailerService } from 'src/integrations/mailer/services/MailerService';
import { ResetPasswordValidationSchema } from '../zod-validation-schemas/ResetPasswordValidationSchema';
import { ResetPasswordDto } from 'src/dto/ResetPasswordDto';
import { UpdateUserHandler } from 'src/business/handlers/User/UpdateUserHandler';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(CreateUserHandler) private createUserHandler: CreateUserHandler,
    @Inject(AuthService) private authService: AuthService,
    @Inject(UserQueryService) private userQueryService: UserQueryService,
    @Inject(MailerService) private mailerService: MailerService,
    @Inject(UpdateUserHandler) private updateUserHandler: UpdateUserHandler,
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

  @Post('/forgot-password')
  @UsePipes(new ZodValidationPipe(ForgotPasswordValidationSchema))
  public async forgotPasswword(@Body() body: ForgotPasswordDto) {
    try {
      const user = await this.userQueryService.findOne(body.email);

      if (user) {
        const payload: VerifiedTokenModel = {
          sub: user.id,
          email: user.email,
        };

        const token = await this.jwtService.signAsync(payload, {
          secret: EnvironmentVariables.config.jwtSecret,
          expiresIn: '10m',
        });
        const resetPasswordLink = `${EnvironmentVariables.config.frontendBaseUrl}/auth/reset-password?token=${token}`;

        const email = `
          Hi ${user.firstName},

          Please follow the link below to reset your password :)

          Link: ${resetPasswordLink}
        `;

        await this.mailerService.sendEmail({
          subject: 'Reset Password',
          receiverEmail: user.email,
          text: email,
        });

        return {
          message: 'Reset password email sent successfully!',
          status: HttpStatus.OK,
        };
      } else {
        throw new HttpException(
          'User does not exist with this email',
          HttpStatus.NOT_FOUND,
        );
      }
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to handle forgot password',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('reset-password')
  @UsePipes(new ZodValidationPipe(ResetPasswordValidationSchema))
  public async resetPassword(@Body() body: ResetPasswordDto) {
    try {
      const { sub } = (await this.jwtService.verifyAsync(body.token, {
        secret: EnvironmentVariables.config.jwtSecret,
      })) as VerifiedTokenModel;

      return await this.updateUserHandler.handle({
        payload: { id: sub, password: body.password },
      });
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to handle reset password',
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
      }
    } catch (error) {
      throw new HttpException(
        'google oauth login error',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
