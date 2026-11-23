import { Table, Column, Model, DataType } from 'sequelize-typescript';

/**
 * Tables for the admin dashboard. None has a foreign key on user_id, so `sequelize.sync()` can
 * create them on deploy without depending on the user table's column type (as with
 * easy_read_usage).
 */

export type ActivityType =
  | 'sign_in'
  | 'sign_up'
  | 'upload'
  | 'test_generated'
  | 'test_finished'
  | 'easy_read'
  | 'viva'
  | 'chat'
  | 'purchase';

export const ACTIVITY_TYPES: ActivityType[] = [
  'sign_in',
  'sign_up',
  'upload',
  'test_generated',
  'test_finished',
  'easy_read',
  'viva',
  'chat',
  'purchase',
];

/** One thing a person did: signed in, uploaded a document, finished a test… */
@Table({
  tableName: 'user_activity',
  indexes: [
    { fields: ['created_on'] },
    { fields: ['user_id', 'created_on'] },
    { fields: ['type', 'created_on'] },
  ],
})
export class UserActivityModel extends Model<UserActivityModel> {
  @Column({ type: DataType.STRING(36), primaryKey: true })
  id: string;

  @Column({ type: DataType.UUID, field: 'user_id', allowNull: false })
  userId: string;

  @Column({ type: DataType.STRING(32), allowNull: false })
  type: ActivityType;

  /** A sentence without the person's name: "uploaded Renal Pharmacology.pdf (36 pages)". */
  @Column({ type: DataType.STRING(500), allowNull: false })
  detail: string;

  /** Small JSON extras, e.g. { "device": "Chrome · Android" } on a sign-in. */
  @Column({ type: DataType.TEXT, allowNull: true })
  meta: string | null;

  @Column({ type: DataType.DATE, field: 'created_on', allowNull: false })
  createdOn: Date;
}

/** Where each person is right now: updated by the app's heartbeat every minute. */
@Table({ tableName: 'user_presence', indexes: [{ fields: ['last_seen_at'] }] })
export class UserPresenceModel extends Model<UserPresenceModel> {
  @Column({ type: DataType.UUID, field: 'user_id', primaryKey: true })
  userId: string;

  @Column({ type: DataType.DATE, field: 'last_seen_at', allowNull: false })
  lastSeenAt: Date;

  /** Start of the current visit (reset after 5 minutes without a heartbeat). */
  @Column({
    type: DataType.DATE,
    field: 'session_started_at',
    allowNull: false,
  })
  sessionStartedAt: Date;

  @Column({ type: DataType.STRING(160), allowNull: true })
  doing: string | null;

  @Column({ type: DataType.STRING(200), allowNull: true })
  path: string | null;

  @Column({ type: DataType.STRING(80), allowNull: true })
  device: string | null;
}

/** One row per person per day they used the app (WAT days), for "active" counts and the chart. */
@Table({
  tableName: 'user_daily_active',
  indexes: [{ unique: true, fields: ['user_id', 'day'] }, { fields: ['day'] }],
})
export class UserDailyActiveModel extends Model<UserDailyActiveModel> {
  @Column({ type: DataType.STRING(36), primaryKey: true })
  id: string;

  @Column({ type: DataType.UUID, field: 'user_id', allowNull: false })
  userId: string;

  /** "YYYY-MM-DD" in Africa/Lagos. */
  @Column({ type: DataType.STRING(10), allowNull: false })
  day: string;
}

/**
 * Time spent reading in Easy Read: seconds per person, per document, per WAT day. Recorded from
 * the reader's 15-second reports for every plan; students never see it. A "session" starts after
 * 15 minutes without a report.
 */
@Table({
  tableName: 'easy_read_reading',
  indexes: [
    {
      name: 'easy_read_reading_user_document_day',
      unique: true,
      fields: ['user_id', 'document_id', 'day'],
    },
    { name: 'easy_read_reading_day_user', fields: ['day', 'user_id'] },
    { name: 'easy_read_reading_last_at_user', fields: ['last_at', 'user_id'] },
  ],
})
export class EasyReadReadingModel extends Model<EasyReadReadingModel> {
  @Column({ type: DataType.STRING(36), primaryKey: true })
  id: string;

  @Column({ type: DataType.UUID, field: 'user_id', allowNull: false })
  userId: string;

  /** The document read; '' when the app didn't say. */
  @Column({
    type: DataType.STRING(64),
    field: 'document_id',
    allowNull: false,
    defaultValue: '',
  })
  documentId: string;

  /** "YYYY-MM-DD" in Africa/Lagos. */
  @Column({ type: DataType.STRING(10), allowNull: false })
  day: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  seconds: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 1 })
  sessions: number;

  @Column({ type: DataType.DATE, field: 'first_at', allowNull: false })
  firstAt: Date;

  @Column({ type: DataType.DATE, field: 'last_at', allowNull: false })
  lastAt: Date;
}

/**
 * Easy Read reading time per person per WAT hour, across documents, so the dashboard can show
 * when students study. Kept beside the per-document table because a reading session often runs
 * across an hour boundary.
 */
@Table({
  tableName: 'easy_read_reading_hour',
  indexes: [
    {
      name: 'easy_read_reading_hour_user_day_hour',
      unique: true,
      fields: ['user_id', 'day', 'hour'],
    },
    { name: 'easy_read_reading_hour_day', fields: ['day'] },
  ],
})
export class EasyReadReadingHourModel extends Model<EasyReadReadingHourModel> {
  @Column({ type: DataType.STRING(36), primaryKey: true })
  id: string;

  @Column({ type: DataType.UUID, field: 'user_id', allowNull: false })
  userId: string;

  /** "YYYY-MM-DD" in Africa/Lagos. */
  @Column({ type: DataType.STRING(10), allowNull: false })
  day: string;

  /** 0–23, Lagos time. */
  @Column({ type: DataType.TINYINT, allowNull: false })
  hour: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  seconds: number;

  @Column({ type: DataType.DATE, field: 'last_at', allowNull: false })
  lastAt: Date;
}
