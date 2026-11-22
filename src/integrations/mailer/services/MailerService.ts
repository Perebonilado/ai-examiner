import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { MailerService as NodeMailerService } from '@nestjs-modules/mailer';
import { SendEmailModel } from '../models/SendEmailModel';
import { EnvironmentVariables } from 'src/EnvironmentVariables';

@Injectable()
export class MailerService {
  constructor(private mailingService: NodeMailerService) {}

  public async sendEmail(payload: SendEmailModel) {
    // Show "AI Examiner" as the sender when the SMTP login is an email address.
    const user = EnvironmentVariables.config.emailUser;
    const from = user && user.includes('@') ? { name: 'AI Examiner', address: user } : undefined;
    try {
      await this.mailingService.sendMail({
        ...(from ? { from } : {}),
        subject: payload.subject,
        to: payload.receiverEmail,
        text: payload.text,
        ...(payload.html ? { html: payload.html } : {}),
        attachments: payload.attachments ? payload.attachments.map((file)=>({
          filename: file.originalname,
          content: file.buffer,
        })) : [],
      });
    } catch (error) {
      throw new HttpException('Failed to send email', HttpStatus.BAD_REQUEST);
    }
  }
}
