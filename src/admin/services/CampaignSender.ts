import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Op } from 'sequelize';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { MailerService } from 'src/integrations/mailer/services/MailerService';
import { CampaignContent } from 'src/integrations/mailer/marketing/types';
import { generateUUID } from 'src/utils';
import {
  EmailPreferenceModel,
  MarketingCampaignModel,
  MarketingRecipientModel,
} from '../models/CampaignModels';
import { CampaignService } from './CampaignService';

const TICK_MS = 30_000;
/** At most this many emails per tick, a short pause between each, to stay well inside Gmail's rate. */
const PER_TICK = 10;
const GAP_MS = 1500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * What to do after a failed send:
 * - "retry": the problem isn't this address (network, sign-in, rate or daily quota): put the
 *   email back in the queue and stop until the next tick.
 * - "bounce": the server says this mailbox doesn't exist: mark it and never send to it again.
 * - "fail": anything else about this one email (e.g. mailbox full): mark it failed.
 */
export const classifySendError = (error: any): 'retry' | 'bounce' | 'fail' => {
  const code = Number(error?.responseCode) || 0;
  const msg = String(error?.response || error?.message || '');
  if (!code) return 'retry';
  if (
    code === 421 ||
    code === 451 ||
    code === 454 ||
    code === 535 ||
    code === 534
  )
    return 'retry';
  // Our own account hit Gmail's sending limit or rate limit (not the recipient's mailbox).
  if (/sending (limit|quota)|rate limit|too many|try again later/i.test(msg))
    return 'retry';
  // The recipient's mailbox is full: skip this one email, keep the address.
  if (code === 552 || /mailbox (is )?full|over quota|quota exceeded/i.test(msg))
    return 'fail';
  if (
    (code === 550 || code === 551 || code === 553) &&
    /user|mailbox|recipient|address|does not exist|no such/i.test(msg)
  )
    return 'bounce';
  return 'fail';
};

/**
 * Sends marketing campaigns in the background, a few emails every 30 seconds, never more than
 * the daily limit (MARKETING_DAILY_LIMIT, default 400) across all campaigns. Scheduled campaigns
 * start when their time comes; their list of people is frozen at that moment.
 */
@Injectable()
export class CampaignSender implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(CampaignService) private campaigns: CampaignService,
    @Inject(MailerService) private mailer: MailerService,
  ) {}

  onModuleInit() {
    if (
      !EnvironmentVariables.config.marketingSenderEnabled ||
      process.env.NODE_ENV === 'test'
    )
      return;
    // Rows left in "sending" when the server last stopped go back in the queue.
    setTimeout(() => {
      void MarketingRecipientModel.update(
        { status: 'queued' },
        { where: { status: 'sending' } },
      )
        .catch(() => undefined)
        .then(() => this.tick());
    }, 15_000).unref?.();
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.startDue();
      await this.sendSome();
    } catch (error) {
      console.error('marketing sender: tick failed', error?.message);
    } finally {
      this.running = false;
    }
  }

  /** Scheduled campaigns whose time has come: freeze the list and start sending. */
  async startDue() {
    const due = await MarketingCampaignModel.findAll({
      where: { status: 'scheduled', scheduledAt: { [Op.lte]: new Date() } },
      order: [['scheduledAt', 'ASC']],
    });
    for (const c of due) {
      // Claim it first so a second instance can't start the same campaign.
      const [claimed] = await MarketingCampaignModel.update(
        { status: 'sending', startedAt: new Date(), updatedOn: new Date() },
        { where: { id: c.id, status: 'scheduled' } },
      );
      if (!claimed) continue;
      const people = await this.campaigns.audiencePeople(c.audience);
      for (let i = 0; i < people.length; i += 500) {
        await MarketingRecipientModel.bulkCreate(
          people.slice(i, i + 500).map((p, j) => ({
            id: generateUUID(),
            campaignId: c.id,
            userId: p.id,
            email: p.email,
            firstName: p.first_name,
            rank: i + j,
            status: 'queued',
          })) as MarketingRecipientModel[],
          { ignoreDuplicates: true },
        );
      }
      await MarketingCampaignModel.update(
        {
          totalRecipients: people.length,
          ...(people.length ? {} : { status: 'sent', finishedAt: new Date() }),
        },
        { where: { id: c.id } },
      );
    }
  }

  async sendSome() {
    let room = this.campaigns.dailyLimit - (await this.campaigns.usedToday());
    if (room <= 0) return;
    let budget = Math.min(room, PER_TICK);
    const sending = await MarketingCampaignModel.findAll({
      where: { status: 'sending' },
      order: [['startedAt', 'ASC']],
    });
    for (const c of sending) {
      if (budget <= 0) break;
      const content = JSON.parse(c.content) as CampaignContent;
      const batch = await MarketingRecipientModel.findAll({
        where: { campaignId: c.id, status: 'queued' },
        order: [['rank', 'ASC']],
        limit: budget,
      });
      for (const r of batch) {
        // Paused while we were sending? Stop here.
        const fresh = await MarketingCampaignModel.findByPk(c.id, {
          attributes: ['status'],
        });
        if (fresh?.status !== 'sending') break;
        const [claimed] = await MarketingRecipientModel.update(
          { status: 'sending' },
          { where: { id: r.id, status: 'queued' } },
        );
        if (!claimed) continue;
        budget--;
        room--;
        const pref = await EmailPreferenceModel.findByPk(r.userId);
        if (pref?.marketingOptOut || pref?.bounced) {
          await r.update({
            status: 'skipped',
            error: pref.bounced ? 'Address bounced before' : 'Unsubscribed',
          });
          continue;
        }
        try {
          const { html, text, headers } = this.campaigns.render(
            {
              id: c.id,
              templateKey: c.templateKey,
              subject: c.subject,
              preheader: c.preheader,
              content,
            },
            { userId: r.userId, firstName: r.firstName },
            { track: true },
          );
          await this.mailer.sendMarketingEmail({
            to: r.email,
            subject: c.subject,
            html,
            text,
            headers,
          });
          await r.update({ status: 'sent', sentAt: new Date(), error: null });
        } catch (error) {
          const outcome = classifySendError(error);
          if (outcome === 'retry') {
            await r.update({ status: 'queued', error: null });
            console.error(
              'marketing sender: pausing until the next tick:',
              error?.responseCode,
              error?.message,
            );
            return;
          }
          await r.update({
            status: 'failed',
            sentAt: null,
            error: String(
              error?.response || error?.message || 'Mail server error',
            ).slice(0, 300),
          });
          if (outcome === 'bounce') {
            await EmailPreferenceModel.upsert({
              userId: r.userId,
              bounced: true,
              marketingOptOut: pref?.marketingOptOut ?? false,
              updatedOn: new Date(),
            } as EmailPreferenceModel);
          }
        }
        if (budget > 0) await sleep(GAP_MS);
      }
      const left = await MarketingRecipientModel.count({
        where: { campaignId: c.id, status: ['queued', 'sending'] },
      });
      if (!left) {
        await MarketingCampaignModel.update(
          { status: 'sent', finishedAt: new Date(), updatedOn: new Date() },
          { where: { id: c.id, status: 'sending' } },
        );
      }
    }
  }
}
