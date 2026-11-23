import { Table, Column, Model, DataType } from 'sequelize-typescript';

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'paused'
  | 'sent';
export type Audience = 'all' | 'active_30d' | 'inactive_30d' | 'free' | 'paid';
export type RecipientStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'skipped';

/** A marketing email and where it is in its life: draft, scheduled, sending, paused, sent. */
@Table({ tableName: 'marketing_campaign', indexes: [{ fields: ['status'] }] })
export class MarketingCampaignModel extends Model<MarketingCampaignModel> {
  @Column({ type: DataType.STRING(36), primaryKey: true })
  id: string;

  @Column({ type: DataType.STRING(160), allowNull: false })
  name: string;

  @Column({ type: DataType.STRING(200), allowNull: false })
  subject: string;

  @Column({ type: DataType.STRING(300), allowNull: false, defaultValue: '' })
  preheader: string;

  @Column({
    type: DataType.STRING(32),
    field: 'template_key',
    allowNull: false,
  })
  templateKey: string;

  /** CampaignContent as JSON. */
  @Column({ type: DataType.TEXT('medium'), allowNull: false })
  content: string;

  @Column({ type: DataType.STRING(32), allowNull: false, defaultValue: 'all' })
  audience: Audience;

  @Column({
    type: DataType.STRING(16),
    allowNull: false,
    defaultValue: 'draft',
  })
  status: CampaignStatus;

  @Column({ type: DataType.DATE, field: 'scheduled_at', allowNull: true })
  scheduledAt: Date | null;

  @Column({ type: DataType.DATE, field: 'started_at', allowNull: true })
  startedAt: Date | null;

  @Column({ type: DataType.DATE, field: 'finished_at', allowNull: true })
  finishedAt: Date | null;

  @Column({
    type: DataType.INTEGER,
    field: 'total_recipients',
    allowNull: false,
    defaultValue: 0,
  })
  totalRecipients: number;

  @Column({ type: DataType.DATE, field: 'test_sent_at', allowNull: true })
  testSentAt: Date | null;

  @Column({ type: DataType.UUID, field: 'created_by', allowNull: true })
  createdBy: string | null;

  @Column({ type: DataType.DATE, field: 'created_on', allowNull: false })
  createdOn: Date;

  @Column({ type: DataType.DATE, field: 'updated_on', allowNull: false })
  updatedOn: Date;
}

/** One person on a campaign's list, frozen when sending starts. */
@Table({
  tableName: 'marketing_recipient',
  indexes: [
    { fields: ['campaign_id', 'status', 'rank'] },
    { fields: ['sent_at'] },
    { unique: true, fields: ['campaign_id', 'user_id'] },
  ],
})
export class MarketingRecipientModel extends Model<MarketingRecipientModel> {
  @Column({ type: DataType.STRING(36), primaryKey: true })
  id: string;

  @Column({ type: DataType.STRING(36), field: 'campaign_id', allowNull: false })
  campaignId: string;

  @Column({ type: DataType.UUID, field: 'user_id', allowNull: false })
  userId: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  email: string;

  @Column({ type: DataType.STRING(120), field: 'first_name', allowNull: true })
  firstName: string | null;

  /** Send order: most recently active people first. */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  rank: number;

  @Column({
    type: DataType.STRING(12),
    allowNull: false,
    defaultValue: 'queued',
  })
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'skipped';

  @Column({ type: DataType.DATE, field: 'sent_at', allowNull: true })
  sentAt: Date | null;

  @Column({ type: DataType.STRING(300), allowNull: true })
  error: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  clicked: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  unsubscribed: boolean;
}

/** One click on a link in a campaign email. */
@Table({ tableName: 'marketing_click', indexes: [{ fields: ['campaign_id'] }] })
export class MarketingClickModel extends Model<MarketingClickModel> {
  @Column({ type: DataType.STRING(36), primaryKey: true })
  id: string;

  @Column({ type: DataType.STRING(36), field: 'campaign_id', allowNull: false })
  campaignId: string;

  @Column({ type: DataType.UUID, field: 'user_id', allowNull: false })
  userId: string;

  @Column({ type: DataType.STRING(1000), allowNull: false })
  url: string;

  @Column({ type: DataType.STRING(200), allowNull: false, defaultValue: '' })
  label: string;

  @Column({ type: DataType.DATE, field: 'created_on', allowNull: false })
  createdOn: Date;
}

/** Whether a person gets marketing email. No row = subscribed. */
@Table({ tableName: 'email_preference' })
export class EmailPreferenceModel extends Model<EmailPreferenceModel> {
  @Column({ type: DataType.UUID, field: 'user_id', primaryKey: true })
  userId: string;

  @Column({
    type: DataType.BOOLEAN,
    field: 'marketing_opt_out',
    allowNull: false,
    defaultValue: false,
  })
  marketingOptOut: boolean;

  /** too_many | not_useful | stopped_using | other */
  @Column({ type: DataType.STRING(32), allowNull: true })
  reason: string | null;

  /** The mail server said this address doesn't exist: never send marketing to it again. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  bounced: boolean;

  @Column({
    type: DataType.STRING(36),
    field: 'unsubscribed_from_campaign_id',
    allowNull: true,
  })
  unsubscribedFromCampaignId: string | null;

  @Column({ type: DataType.DATE, field: 'updated_on', allowNull: false })
  updatedOn: Date;
}
