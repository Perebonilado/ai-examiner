import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { UserModel } from 'src/infra/db/models/UserModel';
import { confirmEmailEmail } from 'src/integrations/mailer/templates/emails';
import { MailerService } from 'src/integrations/mailer/services/MailerService';

const LINK_DAYS = 7;
const RESEND_GAP_MS = 60_000;

/** Ties a link to the password set at sign-up, so signing up again makes older links useless. */
export const passwordMark = (hash: string | null | undefined) =>
  createHash('sha256')
    .update(hash || '')
    .digest('hex')
    .slice(0, 16);

/**
 * Email confirmation for email-and-password accounts: the link in the email opens the account.
 * Confirmation tokens use their own secret, so they can never be used to sign in to the API.
 */
@Injectable()
export class EmailConfirmationService {
  private lastSent = new Map<string, number>();

  constructor(
    private jwtService: JwtService,
    @Inject(MailerService) private mailer: MailerService,
  ) {}

  private get secret() {
    return `${EnvironmentVariables.config.jwtSecret}:confirm-email`;
  }

  private link(token: string) {
    const base = (
      EnvironmentVariables.config.frontendBaseUrl || 'https://aiexaminer.app'
    ).replace(/\/+$/, '');
    return `${base}/auth/confirm-email?token=${encodeURIComponent(token)}`;
  }

  /** An email address's confirmation status needs a password account that isn't confirmed yet. */
  static waiting(user: Pick<UserModel, 'password' | 'emailConfirmed'> | null) {
    return !!user && !!user.password && user.emailConfirmed === false;
  }

  /** Sends the confirmation email (at most once a minute per address). */
  async send(user: UserModel, opts: { force?: boolean } = {}) {
    const key = user.email.toLowerCase();
    const last = this.lastSent.get(key) ?? 0;
    if (!opts.force && Date.now() - last < RESEND_GAP_MS) return false;
    this.lastSent.set(key, Date.now());
    if (this.lastSent.size > 20_000) this.lastSent.clear();

    const token = this.jwtService.sign(
      {
        p: 'confirm_email',
        sub: user.id,
        email: user.email,
        pw: passwordMark(user.password),
      },
      { secret: this.secret, expiresIn: `${LINK_DAYS}d` },
    );
    const email = confirmEmailEmail({
      firstName: user.firstName,
      confirmUrl: this.link(token),
    });
    await this.mailer.sendEmail({
      subject: email.subject,
      receiverEmail: user.email,
      text: email.text,
      html: email.html,
    });
    return true;
  }

  /** The link was opened: confirm the address and sign the student in. */
  async confirm(token: string) {
    let claims: { p?: string; sub?: string; email?: string; pw?: string };
    try {
      claims = await this.jwtService.verifyAsync(token, {
        secret: this.secret,
      });
    } catch {
      throw new HttpException(
        {
          message: 'This link has expired or is not valid.',
          code: 'CONFIRM_LINK_INVALID',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const user =
      claims?.p === 'confirm_email' && claims.sub
        ? await UserModel.findByPk(claims.sub)
        : null;
    if (!user || user.email !== claims.email)
      throw new HttpException(
        {
          message: 'This link is no longer valid.',
          code: 'CONFIRM_LINK_INVALID',
        },
        HttpStatus.BAD_REQUEST,
      );
    if (user.emailConfirmed)
      return {
        status: HttpStatus.OK,
        message: 'Your email is already confirmed.',
        data: { alreadyConfirmed: true },
      };
    if (passwordMark(user.password) !== claims.pw)
      throw new HttpException(
        {
          message:
            'This link was replaced by a newer one. Use the latest email we sent.',
          code: 'CONFIRM_LINK_INVALID',
        },
        HttpStatus.BAD_REQUEST,
      );

    await user.update({ emailConfirmed: true, emailConfirmedOn: new Date() });
    return {
      status: HttpStatus.OK,
      message: 'Email confirmed',
      data: {
        token: await this.jwtService.signAsync(
          { sub: user.id, email: user.email },
          { secret: EnvironmentVariables.config.jwtSecret },
        ),
      },
    };
  }

  /** "Send it again": the same answer whether or not the address has an account waiting. */
  async resend(email: string) {
    const user = await UserModel.findOne({
      where: { email: String(email || '').trim() },
    });
    if (EmailConfirmationService.waiting(user)) await this.send(user!);
    return {
      status: HttpStatus.OK,
      message:
        'If that address has an account waiting to be confirmed, we have sent a new link.',
    };
  }

  /** The student proved they own the address another way (a password reset, Google sign-in). */
  async markConfirmed(
    userId: string,
    opts: { dropUnconfirmedPassword?: boolean } = {},
  ) {
    const user = await UserModel.findByPk(userId);
    if (!user || user.emailConfirmed) return;
    await user.update({
      emailConfirmed: true,
      emailConfirmedOn: new Date(),
      // A password set before the address was confirmed may not be the owner's.
      ...(opts.dropUnconfirmedPassword ? { password: '' } : {}),
    });
  }
}
