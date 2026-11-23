import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { MailerService as NodeMailerService } from '@nestjs-modules/mailer';
import { SendEmailModel } from '../models/SendEmailModel';
import { EnvironmentVariables } from 'src/EnvironmentVariables';

@Injectable()
export class MailerService {
  constructor(private mailingService: NodeMailerService) {}

  public async sendEmail(payload: SendEmailModel) {
    // Local testing: print instead of sending (never set in production).
    if (process.env.MAIL_DRY_RUN === 'true') {
      console.log(
        `[mail dry run] to ${payload.receiverEmail}: ${payload.subject}\n${payload.text}`,
      );
      return;
    }
    // Show "AI Examiner" as the sender when the SMTP login is an email address.
    const user = EnvironmentVariables.config.emailUser;
    const from =
      user && user.includes('@')
        ? { name: 'AI Examiner', address: user }
        : undefined;
    try {
      await this.mailingService.sendMail({
        ...(from ? { from } : {}),
        subject: payload.subject,
        to: payload.receiverEmail,
        text: payload.text,
        ...(payload.html ? { html: payload.html } : {}),
        attachments: payload.attachments
          ? payload.attachments.map((file) => ({
              filename: file.originalname,
              content: file.buffer,
            }))
          : [],
      });
    } catch (error) {
      throw new HttpException('Failed to send email', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Marketing send: HTML + text with extra headers (List-Unsubscribe). Throws the mail server's
   * own error (with `responseCode`), so the caller can tell a missing mailbox from a hiccup.
   */
  public async sendMarketingEmail(payload: {
    to: string;
    subject: string;
    html: string;
    text: string;
    headers?: Record<string, string>;
    replyTo?: string;
  }) {
    const user = EnvironmentVariables.config.emailUser;
    const from =
      user && user.includes('@')
        ? { name: 'AI Examiner', address: user }
        : undefined;
    return this.mailingService.sendMail({
      ...(from ? { from } : {}),
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      headers: payload.headers,
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
    });
  }
}
