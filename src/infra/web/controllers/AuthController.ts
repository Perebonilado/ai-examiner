import { hashPassword } from 'src/utils';
import {
  EmailConfirmationService,
  passwordMark,
} from 'src/infra/auth/services/EmailConfirmationService';
import { UserModel } from 'src/infra/db/models/UserModel';
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
import { LoginGoogleMobileDto, LoginUserDto } from 'src/dto/LoginUserDto';
import { LoginValidationSchema } from '../zod-validation-schemas/LoginValidationSchema';
import { GoogleOauthGuard } from 'src/infra/auth/guards/GoogleOauthGuard';
import { Request, Response } from 'express';
import { UserQueryService } from 'src/query/services/UserQueryService';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { ForgotPasswordDto } from 'src/dto/ForgotPasswordDto';
import { ForgotPasswordValidationSchema } from '../zod-validation-schemas/ForgotPasswordValidationSchema';
import { MailerService } from 'src/integrations/mailer/services/MailerService';
import { resetPasswordEmail } from 'src/integrations/mailer/templates/emails';
import { ResetPasswordValidationSchema } from '../zod-validation-schemas/ResetPasswordValidationSchema';
import { ResetPasswordDto } from 'src/dto/ResetPasswordDto';
import { UpdateUserHandler } from 'src/business/handlers/User/UpdateUserHandler';
import { MobileGoogleValidationSchema } from '../zod-validation-schemas/MobileGoogleValidationSchema';
import { GoogleAuthService } from 'src/infra/auth/services/GoogleAuthService';
import { UserRole } from '../models/UserRole';
import { generateUUID } from 'src/utils';
import { ActivityService } from 'src/admin/services/ActivityService';
import { describeDevice } from 'src/admin/time';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(CreateUserHandler) private createUserHandler: CreateUserHandler,
    @Inject(AuthService) private authService: AuthService,
    @Inject(UserQueryService) private userQueryService: UserQueryService,
    @Inject(MailerService) private mailerService: MailerService,
    @Inject(UpdateUserHandler) private updateUserHandler: UpdateUserHandler,
    @Inject(GoogleAuthService) private googleAuthService: GoogleAuthService,
    private jwtService: JwtService,
    @Inject(ActivityService) private activity: ActivityService,
    @Inject(EmailConfirmationService)
    private confirmations: EmailConfirmationService,
  ) {}

  /** Password-reset links use their own key, never the sign-in key. */
  private get resetSecret() {
    return `${EnvironmentVariables.config.jwtSecret}:reset-password`;
  }

  private pendingConfirmation(email: string) {
    return {
      status: HttpStatus.CREATED,
      message: 'Check your email to confirm your account',
      data: { needsConfirmation: true, email },
    };
  }

  /** The user id inside a sign-in token we just issued (for the activity log). */
  private userIdFromToken(token?: string): string | null {
    try {
      return token
        ? ((this.jwtService.decode(token) as { sub?: string })?.sub ?? null)
        : null;
    } catch {
      return null;
    }
  }

  @Post('/sign-up')
  @UsePipes(new ZodValidationPipe(SignUpValidationSchema))
  public async signUp(@Body() body: CreateUserDto) {
    try {
      const existing = await this.userQueryService.findOne(body.email);
      if (EmailConfirmationService.waiting(existing)) {
        // Never confirmed: the latest sign-up replaces it, and older links stop working.
        await existing!.update({
          firstName: body.firstName,
          lastName: body.lastName,
          password: await hashPassword(body.password),
        });
        await this.confirmations.send(existing!, { force: true });
        return this.pendingConfirmation(existing!.email);
      }
      await this.createUserHandler.handle({
        payload: { ...body, role: UserRole.User, emailConfirmed: false },
      });
      const user = await this.userQueryService.findOne(body.email);
      try {
        await this.confirmations.send(user!, { force: true });
      } catch (error) {
        // The account exists; "Send it again" on the next screen retries.
        console.error('sign-up: confirmation email not sent', error?.message);
      }
      return this.pendingConfirmation(user!.email);
    } catch (error) {
      throw new HttpException(
        error?._innerError ?? 'Failed to create new user',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('/create-guest-account')
  public async createGuestAccount() {
    try {
      const email = `aiexaminerguest${generateUUID()}@aiexaminer.com`;
      const payload = {
        email: email,
        firstName: 'Guest',
        lastName: 'Guest',
        password: '',
        role: UserRole.Guest,
      } as CreateUserDto;

      return await this.createUserHandler.handle({
        payload,
      });
    } catch (error) {
      throw new HttpException(
        error?._innerError ?? 'Failed to guest account',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('/login')
  @UsePipes(new ZodValidationPipe(LoginValidationSchema))
  public async login(@Body() body: LoginUserDto, @Req() req: Request) {
    try {
      const result = await this.authService
        .signIn(body)
        .catch(async (error) => {
          // Right password, address not confirmed yet: send the link again (once a minute at most).
          if (error?.response?.code === 'EMAIL_NOT_CONFIRMED') {
            const user = await this.userQueryService.findOne(body.email);
            if (user)
              await this.confirmations.send(user).catch(() => undefined);
          }
          throw error;
        });
      const device = describeDevice(req.headers['user-agent']);
      this.activity.record(
        this.userIdFromToken(result?.data?.token),
        'sign_in',
        `signed in with email${device ? ` on ${device.replace(' · ', ', ')}` : ''}`,
        { device },
      );
      return result;
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to login user',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('/mobile/google-auth')
  @UsePipes(new ZodValidationPipe(MobileGoogleValidationSchema))
  public async loginWithGoogleMobile(@Body() body: LoginGoogleMobileDto) {
    try {
      const userIdentity = await this.googleAuthService.verifyGoogleToken(
        body.token,
      );

      const { email, firstName, lastName } = userIdentity;

      const user = await this.userQueryService.findOne(email);

      if (user) {
        // Google has checked the address.
        await this.confirmations.markConfirmed(user.id, {
          dropUnconfirmedPassword: true,
        });
        const token = this.jwtService.sign(
          {
            sub: user.id,
            email: user.email,
          },
          { secret: EnvironmentVariables.config.jwtSecret },
        );
        this.activity.record(
          user.id,
          'sign_in',
          'signed in with Google in the app',
          {
            device: 'Android app',
          },
        );

        return {
          status: HttpStatus.OK,
          data: {
            token,
            message: 'Successful',
          },
        };
      } else {
        const createdUser = await this.createUserHandler.handle({
          payload: {
            email,
            firstName,
            lastName,
            password: '',
            role: UserRole.User,
          },
        });

        return {
          status: HttpStatus.OK,
          data: {
            token: createdUser.data.token,
            message: 'Successful',
          },
        };
      }
    } catch (error) {
      throw new HttpException(
        'google oauth login error on mobile',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** The link in the confirmation email: confirms the address and signs the student in. */
  @Post('/confirm-email')
  public async confirmEmail(@Body() body: { token?: string }) {
    return this.confirmations.confirm(String(body?.token ?? ''));
  }

  /** "Send it again" (answers the same whether or not the address has an account). */
  @Post('/resend-confirmation')
  public async resendConfirmation(@Body() body: { email?: string }) {
    return this.confirmations.resend(String(body?.email ?? ''));
  }

  @Post('/forgot-password')
  @UsePipes(new ZodValidationPipe(ForgotPasswordValidationSchema))
  public async forgotPasswword(@Body() body: ForgotPasswordDto) {
    try {
      const user = await this.userQueryService.findOne(body.email);

      if (user) {
        // Reset links have their own key (they can't be used to sign in) and stop working once
        // the password changes, so each works once.
        const token = await this.jwtService.signAsync(
          {
            p: 'reset_password',
            sub: user.id,
            email: user.email,
            pw: passwordMark(user.password),
          },
          { secret: this.resetSecret, expiresIn: '10m' },
        );
        const resetPasswordLink = `${EnvironmentVariables.config.frontendBaseUrl}auth/reset-password?token=${token}`;

        const email = resetPasswordEmail({
          firstName: user.firstName,
          resetUrl: resetPasswordLink,
        });

        await this.mailerService.sendEmail({
          subject: email.subject,
          receiverEmail: user.email,
          text: email.text,
          html: email.html,
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
      let claims: { p?: string; sub?: string; pw?: string };
      try {
        claims = await this.jwtService.verifyAsync(body.token, {
          secret: this.resetSecret,
        });
      } catch {
        throw new HttpException(
          'This reset link has expired. Ask for a new one.',
          HttpStatus.BAD_REQUEST,
        );
      }
      const user =
        claims?.p === 'reset_password' && claims.sub
          ? await UserModel.findByPk(claims.sub)
          : null;
      if (!user || passwordMark(user.password) !== claims.pw)
        throw new HttpException(
          'This reset link has already been used. Ask for a new one.',
          HttpStatus.BAD_REQUEST,
        );
      const sub = user.id;

      const result = await this.updateUserHandler.handle({
        payload: { id: sub, password: body.password },
      });
      // Opening the reset email proves they own the address.
      await this.confirmations.markConfirmed(sub);
      return result;
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
        // Google has checked the address.
        await this.confirmations.markConfirmed(user.id, {
          dropUnconfirmedPassword: true,
        });
        const token = this.jwtService.sign(
          {
            sub: user.id,
            email: user.email,
          },
          { secret: EnvironmentVariables.config.jwtSecret },
        );
        const device = describeDevice(req.headers['user-agent']);
        this.activity.record(
          user.id,
          'sign_in',
          `signed in with Google${device ? ` on ${device.replace(' · ', ', ')}` : ''}`,
          { device },
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
            role: UserRole.User,
          },
        });

        response.redirect(
          `${EnvironmentVariables.config.frontendBaseUrl}/auth/login?token=${createdUser.data.token}&redirectUrl=${EnvironmentVariables.config.frontendBaseUrl}/pricing`,
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
