import { AppEventModel } from '../telemetry/AppEventModel';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { UserModel } from 'src/infra/db/models/UserModel';
import {
  EmailPreferenceModel,
  MarketingRecipientModel,
} from '../models/CampaignModels';
import { CampaignService } from '../services/CampaignService';
import { EmailLinkService } from '../services/EmailLinkService';

const REASONS = ['too_many', 'not_useful', 'stopped_using', 'other'];

/** Links inside marketing emails. No sign-in: each carries its own signed token. */
@Controller('email')
export class EmailPublicController {
  constructor(
    @Inject(EmailLinkService) private links: EmailLinkService,
    @Inject(CampaignService) private campaigns: CampaignService,
  ) {}

  /** A tracked link: remember the click, then go where the link points. */
  @Get('c/:token')
  public async click(@Param('token') token: string, @Res() res: Response) {
    const data = this.links.readClickToken(token);
    if (!data) {
      res.redirect(302, 'https://aiexaminer.app');
      return;
    }
    try {
      if (data.campaignId?.startsWith('fu:'))
        // A follow-up's button: kept as an event for that follow-up.
        await AppEventModel.create({
          userId: data.userId,
          sessionId: 'email',
          name: 'email_clicked',
          path: null,
          ms: null,
          props: JSON.stringify({
            followUpId: data.campaignId.slice(3),
            label: data.label.slice(0, 80),
          }),
          at: new Date(),
          createdOn: new Date(),
        } as AppEventModel);
      else
        await this.campaigns.recordClick(
          data.campaignId,
          data.userId,
          data.url,
          data.label,
        );
    } catch (error) {
      console.error('email click: could not record', error?.message);
    }
    res.redirect(302, data.url);
  }

  private async person(token: string) {
    const data = this.links.readPreferenceToken(token || '');
    if (!data)
      throw new HttpException('This link is not valid', HttpStatus.BAD_REQUEST);
    const user = await UserModel.findByPk(data.userId, {
      attributes: ['id', 'email'],
    });
    if (!user)
      throw new HttpException('This link is not valid', HttpStatus.NOT_FOUND);
    return { ...data, email: user.email };
  }

  @Get('preferences')
  public async preferences(@Query('token') token: string) {
    const p = await this.person(token);
    const pref = await EmailPreferenceModel.findByPk(p.userId);
    return { email: p.email, subscribed: !pref?.marketingOptOut };
  }

  private async unsubscribe(token: string, reason?: string) {
    const p = await this.person(token);
    const existing = await EmailPreferenceModel.findByPk(p.userId);
    const firstTime = !existing?.marketingOptOut;
    await EmailPreferenceModel.upsert({
      userId: p.userId,
      marketingOptOut: true,
      bounced: existing?.bounced ?? false,
      reason:
        reason && REASONS.includes(reason)
          ? reason
          : (existing?.reason ?? null),
      unsubscribedFromCampaignId: firstTime
        ? p.campaignId
        : (existing?.unsubscribedFromCampaignId ?? null),
      updatedOn: new Date(),
    } as EmailPreferenceModel);
    if (firstTime && p.campaignId) {
      await MarketingRecipientModel.update(
        { unsubscribed: true },
        { where: { campaignId: p.campaignId, userId: p.userId } },
      );
    }
    return p;
  }

  @Post('unsubscribe')
  public async unsubscribeFromPage(
    @Body() body: { token?: string; reason?: string },
  ) {
    const p = await this.unsubscribe(String(body?.token || ''), body?.reason);
    return { email: p.email, subscribed: false };
  }

  /** RFC 8058 one-click unsubscribe (mail apps' own Unsubscribe button). */
  @Post('unsubscribe/one-click')
  @HttpCode(HttpStatus.OK)
  public async unsubscribeOneClick(@Query('token') token: string) {
    await this.unsubscribe(token);
    return { ok: true };
  }

  @Post('resubscribe')
  public async resubscribe(@Body() body: { token?: string }) {
    const p = await this.person(String(body?.token || ''));
    const existing = await EmailPreferenceModel.findByPk(p.userId);
    await EmailPreferenceModel.upsert({
      userId: p.userId,
      marketingOptOut: false,
      bounced: existing?.bounced ?? false,
      reason: null,
      unsubscribedFromCampaignId: existing?.unsubscribedFromCampaignId ?? null,
      updatedOn: new Date(),
    } as EmailPreferenceModel);
    return { email: p.email, subscribed: true };
  }
}
