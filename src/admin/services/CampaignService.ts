import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Op } from 'sequelize';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { generateUUID } from 'src/utils';
import { MailerService } from 'src/integrations/mailer/services/MailerService';
import { renderMarketingEmail } from 'src/integrations/mailer/marketing/render';
import {
  MARKETING_TEMPLATES,
  getTemplate,
} from 'src/integrations/mailer/marketing/templates';
import {
  CampaignContent,
  TemplateKey,
} from 'src/integrations/mailer/marketing/types';
import {
  Audience,
  CampaignStatus,
  EmailPreferenceModel,
  MarketingCampaignModel,
  MarketingClickModel,
  MarketingRecipientModel,
} from '../models/CampaignModels';
import {
  IS_PAID_SQL,
  LAST_ACTIVE_SQL,
  REAL_EMAIL_SQL,
  USER_FACTS_JOINS,
  iso,
  select,
} from '../sql';
import { addDays, sqlWatDay, startOfWatDay, watDay } from '../time';
import { FollowUpModel } from '../insights/models';
import { EmailLinkService } from './EmailLinkService';

export const AUDIENCES: { key: Audience; label: string }[] = [
  { key: 'all', label: 'Everyone subscribed' },
  { key: 'active_30d', label: 'Active in the last 30 days' },
  { key: 'inactive_30d', label: 'Not seen in 30 days' },
  { key: 'free', label: 'Free plan' },
  { key: 'paid', label: 'Paid plans' },
];
const AUDIENCE_KEYS = AUDIENCES.map((a) => a.key);
const EDITABLE: CampaignStatus[] = ['draft', 'scheduled', 'paused'];

const AUDIENCE_SQL: Record<Audience, string> = {
  all: '1 = 1',
  active_30d: 't.last_active >= :d30',
  inactive_30d: '(t.last_active IS NULL OR t.last_active < :d30)',
  free: 't.paid = 0',
  paid: 't.paid = 1',
};

/** Everyone who can get marketing email, with what we need to pick and order them. */
const SUBSCRIBED_PEOPLE_SQL = `
  SELECT u.id, u.email, u.first_name, ${LAST_ACTIVE_SQL} AS last_active,
         CASE WHEN ${IS_PAID_SQL} THEN 1 ELSE 0 END AS paid
  FROM user u ${USER_FACTS_JOINS}
  WHERE u.role = 'user' AND ${REAL_EMAIL_SQL}
    AND COALESCE(ep.marketing_opt_out, 0) = 0 AND COALESCE(ep.bounced, 0) = 0`;

const URL_FIELDS = (c: CampaignContent): (string | undefined)[] => [
  c.imageUrl,
  c.button?.url,
  c.event?.calendarUrl,
  c.resume?.url,
  ...(c.cards || []).map((x) => x.url),
];

/**
 * Plan how many emails go out on each day, `dailyLimit` a day, after `ahead` emails already
 * queued by earlier campaigns; the first day only has `firstDayRoom` left.
 */
export const planDays = (
  count: number,
  ahead: number,
  firstDayRoom: number,
  dailyLimit: number,
  startDay: string,
): { date: string; count: number }[] => {
  const out: { date: string; count: number }[] = [];
  let day = startDay;
  let room = Math.max(0, firstDayRoom);
  let toSkip = ahead;
  let left = count;
  for (let guard = 0; left > 0 && guard < 3650; guard++) {
    const skipped = Math.min(room, toSkip);
    room -= skipped;
    toSkip -= skipped;
    const n = Math.min(room, left);
    if (n > 0) out.push({ date: day, count: n });
    left -= n;
    day = addDays(day, 1);
    room = dailyLimit;
  }
  return out;
};

@Injectable()
export class CampaignService {
  constructor(
    @Inject(MailerService) private mailer: MailerService,
    @Inject(EmailLinkService) private links: EmailLinkService,
  ) {}

  get dailyLimit() {
    return EnvironmentVariables.config.marketingDailyLimit;
  }

  templates() {
    return MARKETING_TEMPLATES;
  }

  /** Marketing emails sent today (WAT): every campaign, plus follow-up emails. */
  async usedToday(): Promise<number> {
    const [campaigns, followUps] = await Promise.all([
      MarketingRecipientModel.count({
        where: { status: 'sent', sentAt: { [Op.gte]: startOfWatDay() } },
      }),
      FollowUpModel.count({
        where: { status: 'sent', sentOn: { [Op.gte]: startOfWatDay() } },
      }),
    ]);
    return campaigns + followUps;
  }

  async audiences() {
    const d30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const rows = await select(
      `SELECT COUNT(*) AS all_n,
              SUM(CASE WHEN ${AUDIENCE_SQL.active_30d} THEN 1 ELSE 0 END) AS active_30d,
              SUM(CASE WHEN ${AUDIENCE_SQL.inactive_30d} THEN 1 ELSE 0 END) AS inactive_30d,
              SUM(CASE WHEN ${AUDIENCE_SQL.free} THEN 1 ELSE 0 END) AS free_n,
              SUM(CASE WHEN ${AUDIENCE_SQL.paid} THEN 1 ELSE 0 END) AS paid_n
       FROM (${SUBSCRIBED_PEOPLE_SQL}) t`,
      { d30 },
    );
    const r = rows[0] || {};
    const counts: Record<Audience, number> = {
      all: Number(r.all_n ?? 0),
      active_30d: Number(r.active_30d ?? 0),
      inactive_30d: Number(r.inactive_30d ?? 0),
      free: Number(r.free_n ?? 0),
      paid: Number(r.paid_n ?? 0),
    };
    return AUDIENCES.map((a) => ({ ...a, count: counts[a.key] }));
  }

  /** The people a campaign goes to, most recently active first. */
  async audiencePeople(audience: Audience) {
    const d30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    return select<{ id: string; email: string; first_name: string | null }>(
      `SELECT t.id, t.email, t.first_name FROM (${SUBSCRIBED_PEOPLE_SQL}) t
       WHERE ${AUDIENCE_SQL[audience]}
       ORDER BY t.last_active IS NULL, t.last_active DESC`,
      { d30 },
    );
  }

  async list(status?: string) {
    const all = await MarketingCampaignModel.findAll({
      order: [['createdOn', 'DESC']],
    });
    const counts = {
      all: all.length,
      draft: 0,
      scheduled: 0,
      sending: 0,
      paused: 0,
      sent: 0,
    };
    all.forEach((c) => (counts[c.status] = (counts[c.status] || 0) + 1));
    const shown =
      status && status !== 'all' ? all.filter((c) => c.status === status) : all;
    const [audiences, unsubscribed, usedToday] = await Promise.all([
      this.audiences(),
      EmailPreferenceModel.count({ where: { marketingOptOut: true } }),
      this.usedToday(),
    ]);
    const stats = await this.statsFor(shown.map((c) => c.id));
    const campaigns = await Promise.all(
      shown.map((c) => this.toDto(c, stats.get(c.id))),
    );
    return {
      counts,
      subscribed: audiences.find((a) => a.key === 'all')!.count,
      unsubscribed,
      dailyLimit: this.dailyLimit,
      usedToday,
      campaigns,
    };
  }

  private async statsFor(ids: string[]) {
    const map = new Map<
      string,
      {
        sent: number;
        failed: number;
        queued: number;
        clicked: number;
        unsubscribed: number;
      }
    >();
    if (!ids.length) return map;
    const rows = await select(
      `SELECT campaign_id,
              SUM(status = 'sent') AS sent, SUM(status = 'failed') AS failed,
              SUM(status IN ('queued', 'sending')) AS queued,
              SUM(clicked = 1) AS clicked, SUM(unsubscribed = 1) AS unsubscribed
       FROM marketing_recipient WHERE campaign_id IN (:ids) GROUP BY campaign_id`,
      { ids },
    );
    rows.forEach((r) =>
      map.set(r.campaign_id, {
        sent: Number(r.sent ?? 0),
        failed: Number(r.failed ?? 0),
        queued: Number(r.queued ?? 0),
        clicked: Number(r.clicked ?? 0),
        unsubscribed: Number(r.unsubscribed ?? 0),
      }),
    );
    return map;
  }

  /** Emails queued by sending campaigns that started before this one. */
  private async queuedAhead(
    campaign: MarketingCampaignModel | null,
  ): Promise<number> {
    const others = await MarketingCampaignModel.findAll({
      where: {
        status: 'sending',
        ...(campaign ? { id: { [Op.ne]: campaign.id } } : {}),
        ...(campaign?.startedAt
          ? { startedAt: { [Op.lt]: campaign.startedAt } }
          : {}),
      },
      attributes: ['id'],
    });
    if (!others.length) return 0;
    return MarketingRecipientModel.count({
      where: {
        campaignId: others.map((o) => o.id),
        status: ['queued', 'sending'],
      },
    });
  }

  async estimate(
    campaign: MarketingCampaignModel | null,
    recipients: number,
    sendAt?: Date | null,
  ) {
    const today = watDay();
    const startDay =
      sendAt && sendAt.getTime() > Date.now() ? watDay(sendAt) : today;
    const used = startDay === today ? await this.usedToday() : 0;
    const ahead = await this.queuedAhead(campaign);
    const plan = planDays(
      recipients,
      ahead,
      this.dailyLimit - used,
      this.dailyLimit,
      startDay,
    );
    return {
      recipients,
      days: plan.length,
      dailyLimit: this.dailyLimit,
      startsOn: plan[0]?.date ?? startDay,
      finishesOn: plan[plan.length - 1]?.date ?? startDay,
      plan,
    };
  }

  private async toDto(
    c: MarketingCampaignModel,
    s?: {
      sent: number;
      failed: number;
      queued: number;
      clicked: number;
      unsubscribed: number;
    },
  ) {
    const stats = s ?? {
      sent: 0,
      failed: 0,
      queued: 0,
      clicked: 0,
      unsubscribed: 0,
    };
    let estimate: { finishesOn: string | null; days: number } | null = null;
    if (c.status === 'sending' || c.status === 'paused') {
      const e = await this.estimate(c, stats.queued);
      estimate = {
        finishesOn: stats.queued ? e.finishesOn : watDay(),
        days: e.days,
      };
    } else if (c.status === 'scheduled') {
      const count =
        (await this.audiences()).find((a) => a.key === c.audience)?.count ?? 0;
      const e = await this.estimate(c, count, c.scheduledAt);
      estimate = { finishesOn: e.finishesOn, days: e.days };
    }
    let content: CampaignContent;
    try {
      content = JSON.parse(c.content);
    } catch {
      content = (
        getTemplate(c.templateKey as TemplateKey) ?? MARKETING_TEMPLATES[0]
      ).defaults;
    }
    return {
      id: c.id,
      name: c.name,
      subject: c.subject,
      preheader: c.preheader,
      templateKey: c.templateKey as TemplateKey,
      content,
      audience: c.audience,
      status: c.status,
      scheduledAt: iso(c.scheduledAt),
      startedAt: iso(c.startedAt),
      finishedAt: iso(c.finishedAt),
      totalRecipients: c.totalRecipients,
      sentCount: stats.sent,
      failedCount: stats.failed,
      clickCount: stats.clicked,
      unsubscribeCount: stats.unsubscribed,
      testSentAt: iso(c.testSentAt),
      createdOn: iso(c.createdOn),
      updatedOn: iso(c.updatedOn),
      estimate,
    };
  }

  async find(id: string): Promise<MarketingCampaignModel> {
    const c = await MarketingCampaignModel.findByPk(id);
    if (!c) throw new HttpException('Campaign not found', HttpStatus.NOT_FOUND);
    return c;
  }

  async get(id: string) {
    const c = await this.find(id);
    return this.toDto(c, (await this.statsFor([c.id])).get(c.id));
  }

  async create(templateKey: string, adminId: string) {
    const tpl = MARKETING_TEMPLATES.find((t) => t.key === templateKey);
    if (!tpl)
      throw new HttpException('Unknown template', HttpStatus.BAD_REQUEST);
    const now = new Date();
    const c = await MarketingCampaignModel.create({
      id: generateUUID(),
      name: `${tpl.title} · ${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' })}`,
      subject: tpl.defaultSubject,
      preheader: tpl.defaultPreheader,
      templateKey: tpl.key,
      content: JSON.stringify(tpl.defaults),
      audience: 'all',
      status: 'draft',
      createdBy: adminId,
      createdOn: now,
      updatedOn: now,
    } as MarketingCampaignModel);
    return this.toDto(c);
  }

  private cleanContent(content: unknown): CampaignContent {
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      throw new HttpException(
        'Content must be an object',
        HttpStatus.BAD_REQUEST,
      );
    }
    const c = content as CampaignContent;
    for (const url of URL_FIELDS(c)) {
      if (url && !/^https?:\/\//i.test(url.trim())) {
        throw new HttpException(
          `Links must start with https:// (got "${url.slice(0, 60)}")`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    const json = JSON.stringify(c);
    if (json.length > 200_000)
      throw new HttpException('Content is too long', HttpStatus.BAD_REQUEST);
    return c;
  }

  async update(
    id: string,
    body: {
      name?: string;
      subject?: string;
      preheader?: string;
      templateKey?: string;
      content?: unknown;
      audience?: string;
    },
  ) {
    const c = await this.find(id);
    if (!EDITABLE.includes(c.status)) {
      throw new HttpException(
        'This campaign can no longer be edited',
        HttpStatus.CONFLICT,
      );
    }
    const patch: Partial<MarketingCampaignModel> = { updatedOn: new Date() };
    if (typeof body.name === 'string')
      patch.name = body.name.trim().slice(0, 160) || c.name;
    if (typeof body.subject === 'string')
      patch.subject = body.subject.trim().slice(0, 200);
    if (typeof body.preheader === 'string')
      patch.preheader = body.preheader.trim().slice(0, 300);
    if (typeof body.templateKey === 'string') {
      if (!MARKETING_TEMPLATES.some((t) => t.key === body.templateKey)) {
        throw new HttpException('Unknown template', HttpStatus.BAD_REQUEST);
      }
      patch.templateKey = body.templateKey;
    }
    if (body.content !== undefined)
      patch.content = JSON.stringify(this.cleanContent(body.content));
    if (typeof body.audience === 'string') {
      if (!AUDIENCE_KEYS.includes(body.audience as Audience)) {
        throw new HttpException('Unknown audience', HttpStatus.BAD_REQUEST);
      }
      patch.audience = body.audience as Audience;
    }
    await c.update(patch);
    return this.get(id);
  }

  async remove(id: string) {
    const c = await this.find(id);
    if (c.status !== 'draft')
      throw new HttpException(
        'Only drafts can be deleted',
        HttpStatus.CONFLICT,
      );
    await c.destroy();
  }

  /** Render for one person (sending) or for the admin (preview and test). */
  render(
    c: {
      id: string;
      templateKey: string;
      subject: string;
      preheader: string;
      content: CampaignContent;
    },
    person: { userId: string; firstName: string | null },
    opts: {
      track: boolean;
      trackLink?: (url: string, label: string) => string;
    },
  ) {
    const token = this.links.preferenceToken(
      person.userId,
      opts.track ? c.id : null,
    );
    const rendered = renderMarketingEmail(
      c.templateKey as TemplateKey,
      c.content,
      {
        subject: c.subject,
        preheader: c.preheader,
        firstName: person.firstName,
        trackLink: (url, label) =>
          opts.trackLink
            ? opts.trackLink(url, label)
            : opts.track
              ? this.links.trackedUrl(c.id, person.userId, url, label)
              : url,
        unsubscribeUrl: this.links.unsubscribePageUrl(token),
        postalAddress:
          EnvironmentVariables.config.postalAddress || '[YOUR POSTAL ADDRESS]',
      },
    );
    return { ...rendered, headers: this.links.listUnsubscribeHeaders(token) };
  }

  private merged(
    c: MarketingCampaignModel,
    body: {
      subject?: string;
      preheader?: string;
      templateKey?: string;
      content?: unknown;
    },
  ) {
    return {
      id: c.id,
      templateKey:
        typeof body.templateKey === 'string' &&
        MARKETING_TEMPLATES.some((t) => t.key === body.templateKey)
          ? body.templateKey
          : c.templateKey,
      subject: typeof body.subject === 'string' ? body.subject : c.subject,
      preheader:
        typeof body.preheader === 'string' ? body.preheader : c.preheader,
      content:
        body.content !== undefined
          ? this.cleanContent(body.content)
          : (JSON.parse(c.content) as CampaignContent),
    };
  }

  async preview(
    id: string,
    body: {
      subject?: string;
      preheader?: string;
      templateKey?: string;
      content?: unknown;
    },
    admin: { id: string; firstName: string | null },
  ) {
    const c = await this.find(id);
    const { html, text } = this.render(
      this.merged(c, body),
      { userId: admin.id, firstName: admin.firstName },
      { track: false },
    );
    return { html, text };
  }

  async sendTest(
    id: string,
    admin: { id: string; email: string; firstName: string | null },
    to?: string,
  ) {
    const c = await this.find(id);
    const target = (to || admin.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      throw new HttpException(
        'Enter a valid email address',
        HttpStatus.BAD_REQUEST,
      );
    }
    const data = this.merged(c, {});
    const { html, text, headers } = this.render(
      data,
      { userId: admin.id, firstName: admin.firstName },
      { track: false },
    );
    try {
      await this.mailer.sendMarketingEmail({
        to: target,
        subject: `[Test] ${data.subject}`,
        html,
        text,
        headers,
      });
    } catch (error) {
      throw new HttpException(
        `The test email couldn't be sent: ${error?.message ?? 'mail server error'}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
    await c.update({ testSentAt: new Date() });
    return { sentTo: target };
  }

  async schedule(id: string, sendAt: string | null | undefined) {
    const c = await this.find(id);
    if (!['draft', 'scheduled'].includes(c.status)) {
      throw new HttpException(
        'Only drafts and scheduled campaigns can be scheduled',
        HttpStatus.CONFLICT,
      );
    }
    if (!EnvironmentVariables.config.postalAddress) {
      throw new HttpException(
        'Add the postal address for the email footer (POSTAL_ADDRESS on the server) before sending marketing email.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!c.subject.trim())
      throw new HttpException('Add a subject first', HttpStatus.BAD_REQUEST);
    let when = new Date();
    if (sendAt) {
      when = new Date(sendAt);
      if (Number.isNaN(when.getTime()))
        throw new HttpException('Invalid send time', HttpStatus.BAD_REQUEST);
    }
    await c.update({
      status: 'scheduled',
      scheduledAt: when,
      updatedOn: new Date(),
    });
    return this.get(id);
  }

  async setStatus(id: string, action: 'pause' | 'resume' | 'unschedule') {
    const c = await this.find(id);
    const allowed: Record<typeof action, [CampaignStatus, CampaignStatus]> = {
      pause: ['sending', 'paused'],
      resume: ['paused', 'sending'],
      unschedule: ['scheduled', 'draft'],
    };
    const [from, to] = allowed[action];
    if (c.status !== from)
      throw new HttpException(
        `Only ${from} campaigns can do that`,
        HttpStatus.CONFLICT,
      );
    await c.update({
      status: to,
      updatedOn: new Date(),
      ...(action === 'unschedule' ? { scheduledAt: null } : {}),
    });
    return this.get(id);
  }

  async report(id: string) {
    const c = await this.find(id);
    const campaign = await this.get(id);
    const today = watDay();
    const [sentByDay, clicks, bounces] = await Promise.all([
      select<{ day: string; n: number }>(
        `SELECT ${sqlWatDay('sent_at')} AS day, COUNT(*) AS n FROM marketing_recipient
         WHERE campaign_id = :id AND status = 'sent' GROUP BY day ORDER BY day`,
        { id },
      ),
      select<{ url: string; label: string; n: number }>(
        `SELECT url, MAX(label) AS label, COUNT(DISTINCT user_id) AS n FROM marketing_click
         WHERE campaign_id = :id GROUP BY url ORDER BY n DESC LIMIT 20`,
        { id },
      ),
      MarketingRecipientModel.findAll({
        where: { campaignId: id, status: 'failed' },
        attributes: ['email', 'error'],
        limit: 200,
      }),
    ]);
    const days: {
      date: string;
      count: number;
      status: 'sent' | 'today' | 'queued';
    }[] = sentByDay.map((r) => ({
      date: r.day,
      count: Number(r.n),
      status: r.day === today ? 'today' : 'sent',
    }));
    const queued = await MarketingRecipientModel.count({
      where: { campaignId: id, status: ['queued', 'sending'] },
    });
    if (queued && c.status !== 'draft') {
      const est = await this.estimate(
        c,
        queued,
        c.status === 'scheduled' ? c.scheduledAt : null,
      );
      for (const p of est.plan) {
        const existing = days.find((d) => d.date === p.date);
        if (existing) existing.count += p.count;
        else
          days.push({
            date: p.date,
            count: p.count,
            status: p.date === today ? 'today' : 'queued',
          });
      }
    }
    return {
      campaign,
      days,
      links: this.linksWithClicks(campaign, clicks),
      bounces: {
        count: bounces.length,
        items: bounces.map((b) => ({
          email: b.email,
          reason: b.error || 'Rejected by the mail server',
        })),
      },
    };
  }

  /** Every link in the email, in order, with how many people clicked it (0 until someone does). */
  private linksWithClicks(
    c: {
      templateKey: string;
      subject: string;
      preheader: string;
      content: CampaignContent;
    },
    clicks: { url: string; label: string; n: number }[],
  ) {
    const links: { label: string; url: string; clicks: number }[] = [];
    try {
      renderMarketingEmail(c.templateKey as TemplateKey, c.content, {
        subject: c.subject,
        preheader: c.preheader,
        firstName: null,
        trackLink: (url, label) => {
          if (!links.some((l) => l.url === url))
            links.push({ label: label || url, url, clicks: 0 });
          return url;
        },
        unsubscribeUrl: '',
        postalAddress: '',
      });
    } catch {
      // A broken draft still gets a report, just without its link list.
    }
    for (const r of clicks) {
      const link = links.find((l) => l.url === r.url);
      if (link) link.clicks = Number(r.n);
      else
        links.push({
          label: r.label || r.url,
          url: r.url,
          clicks: Number(r.n),
        });
    }
    return links.sort((a, b) => b.clicks - a.clicks);
  }

  /** For the click redirect: remember the click. */
  async recordClick(
    campaignId: string,
    userId: string,
    url: string,
    label: string,
  ) {
    await MarketingClickModel.create({
      id: generateUUID(),
      campaignId,
      userId,
      url: url.slice(0, 1000),
      label: label.slice(0, 200),
      createdOn: new Date(),
    } as MarketingClickModel);
    await MarketingRecipientModel.update(
      { clicked: true },
      { where: { campaignId, userId } },
    );
  }
}
