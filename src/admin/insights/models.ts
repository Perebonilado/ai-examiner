import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Tables for the feedback loop: Claude's labels on chats, tests and documents, the batches they
 * came from, weekly themes, follow-ups, students' own ratings, and a log of admin views. No foreign
 * keys, so `sequelize.sync()` can create them on deploy whatever the user table's column type.
 */

export type LabelKind = 'chat' | 'test' | 'document';
export const LABEL_KINDS: LabelKind[] = ['chat', 'test', 'document'];

/** One labelled item: a chat conversation, a test attempt (or essay), or a document. */
@Table({
  tableName: 'ai_label',
  indexes: [
    { name: 'ai_label_kind_item', unique: true, fields: ['kind', 'item_key'] },
    { name: 'ai_label_kind_occurred', fields: ['kind', 'occurred_on'] },
    { name: 'ai_label_user', fields: ['user_id'] },
    { name: 'ai_label_batch', fields: ['batch_id'] },
  ],
})
export class AiLabelModel extends Model<AiLabelModel> {
  @Column({ type: DataType.STRING(36), primaryKey: true })
  id: string;

  @Column({ type: DataType.STRING(16), allowNull: false })
  kind: LabelKind;

  /** Conversation: its first message id. Test: the progress row id (or "essay:<id>"). Document: its id. */
  @Column({ type: DataType.STRING(64), field: 'item_key', allowNull: false })
  itemKey: string;

  @Column({ type: DataType.STRING(36), field: 'user_id', allowNull: true })
  userId: string | null;

  @Column({ type: DataType.STRING(64), field: 'document_id', allowNull: true })
  documentId: string | null;

  /** When the thing happened (conversation start, last answer, upload). */
  @Column({ type: DataType.DATE, field: 'occurred_on', allowNull: false })
  occurredOn: Date;

  /** pending (in a batch), done, skipped (Claude declined), failed. */
  @Column({ type: DataType.STRING(12), allowNull: false })
  status: string;

  @Column({ type: DataType.STRING(64), field: 'batch_id', allowNull: true })
  batchId: string | null;

  @Column({ type: DataType.STRING(12), allowNull: true })
  mood: string | null;

  @Column({ type: DataType.STRING(8), allowNull: true })
  confidence: string | null;

  @Column({ type: DataType.STRING(40), allowNull: true })
  intent: string | null;

  @Column({ type: DataType.STRING(16), allowNull: true })
  outcome: string | null;

  /** JSON array of issue tags. */
  @Column({ type: DataType.TEXT, allowNull: true })
  issues: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  summary: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  quote: string | null;

  @Column({ type: DataType.TEXT, field: 'fix_idea', allowNull: true })
  fixIdea: string | null;

  /** JSON: kind-specific fields (document subject and kind; test struggles and status). */
  @Column({ type: DataType.TEXT, allowNull: true })
  details: string | null;

  @Column({ type: DataType.STRING(40), allowNull: true })
  model: string | null;

  @Column({
    type: DataType.STRING(12),
    field: 'prompt_version',
    allowNull: true,
  })
  promptVersion: string | null;

  @Column({ type: DataType.INTEGER, field: 'input_tokens', allowNull: true })
  inputTokens: number | null;

  @Column({ type: DataType.INTEGER, field: 'output_tokens', allowNull: true })
  outputTokens: number | null;

  /** An admin's correction: the right mood, or that the label is wrong. */
  @Column({
    type: DataType.STRING(12),
    field: 'corrected_mood',
    allowNull: true,
  })
  correctedMood: string | null;

  @Column({ type: DataType.BOOLEAN, field: 'marked_wrong', allowNull: true })
  markedWrong: boolean | null;

  @Column({
    type: DataType.STRING(191),
    field: 'corrected_by',
    allowNull: true,
  })
  correctedBy: string | null;

  @Column({ type: DataType.DATE, field: 'corrected_on', allowNull: true })
  correctedOn: Date | null;

  @Column({ type: DataType.DATE, field: 'created_on', allowNull: false })
  createdOn: Date;

  @Column({ type: DataType.DATE, field: 'labelled_on', allowNull: true })
  labelledOn: Date | null;
}

/** A Message Batches job sent to Claude. */
@Table({
  tableName: 'ai_batch',
  indexes: [{ name: 'ai_batch_status', fields: ['status'] }],
})
export class AiBatchModel extends Model<AiBatchModel> {
  /** Anthropic's batch id. */
  @Column({ type: DataType.STRING(64), primaryKey: true })
  id: string;

  /** labels | drafts */
  @Column({ type: DataType.STRING(16), allowNull: false })
  purpose: string;

  /** submitted, importing, imported, failed. */
  @Column({ type: DataType.STRING(12), allowNull: false })
  status: string;

  @Column({ type: DataType.INTEGER, field: 'item_count', allowNull: false })
  itemCount: number;

  @Column({
    type: DataType.INTEGER,
    field: 'done_count',
    allowNull: false,
    defaultValue: 0,
  })
  doneCount: number;

  @Column({
    type: DataType.INTEGER,
    field: 'failed_count',
    allowNull: false,
    defaultValue: 0,
  })
  failedCount: number;

  /** Token totals from the results, for the cost shown in the admin. */
  @Column({
    type: DataType.BIGINT,
    field: 'input_tokens',
    allowNull: false,
    defaultValue: 0,
  })
  inputTokens: number;

  @Column({
    type: DataType.BIGINT,
    field: 'cache_write_tokens',
    allowNull: false,
    defaultValue: 0,
  })
  cacheWriteTokens: number;

  @Column({
    type: DataType.BIGINT,
    field: 'cache_read_tokens',
    allowNull: false,
    defaultValue: 0,
  })
  cacheReadTokens: number;

  @Column({
    type: DataType.BIGINT,
    field: 'output_tokens',
    allowNull: false,
    defaultValue: 0,
  })
  outputTokens: number;

  /** What was asked for, e.g. "2026-01-01 to 2026-11-23 · chat, test". */
  @Column({ type: DataType.STRING(200), allowNull: true })
  note: string | null;

  @Column({
    type: DataType.STRING(191),
    field: 'requested_by',
    allowNull: true,
  })
  requestedBy: string | null;

  @Column({ type: DataType.DATE, field: 'submitted_on', allowNull: false })
  submittedOn: Date;

  @Column({ type: DataType.DATE, field: 'ended_on', allowNull: true })
  endedOn: Date | null;

  @Column({ type: DataType.DATE, field: 'updated_on', allowNull: false })
  updatedOn: Date;
}

/** Claude's summary of the themes in a date range. */
@Table({
  tableName: 'ai_digest',
  indexes: [{ name: 'ai_digest_range', fields: ['range_from', 'range_to'] }],
})
export class AiDigestModel extends Model<AiDigestModel> {
  @Column({ type: DataType.STRING(36), primaryKey: true })
  id: string;

  @Column({ type: DataType.STRING(10), field: 'range_from', allowNull: false })
  rangeFrom: string;

  @Column({ type: DataType.STRING(10), field: 'range_to', allowNull: false })
  rangeTo: string;

  /** JSON: { headline, sections: [{ kind, themes: [...] }], brightSpots: [...] }. */
  @Column({ type: DataType.TEXT('medium'), allowNull: false })
  content: string;

  @Column({ type: DataType.INTEGER, field: 'label_count', allowNull: false })
  labelCount: number;

  @Column({ type: DataType.STRING(40), allowNull: false })
  model: string;

  @Column({ type: DataType.DATE, field: 'created_on', allowNull: false })
  createdOn: Date;
}

/** A suggested follow-up email for one student. */
@Table({
  tableName: 'follow_up',
  indexes: [
    { name: 'follow_up_status', fields: ['status', 'created_on'] },
    { name: 'follow_up_user', fields: ['user_id', 'created_on'] },
  ],
})
export class FollowUpModel extends Model<FollowUpModel> {
  @Column({ type: DataType.STRING(36), primaryKey: true })
  id: string;

  @Column({ type: DataType.STRING(36), field: 'user_id', allowNull: false })
  userId: string;

  @Column({ type: DataType.STRING(32), allowNull: false })
  rule: string;

  /** drafting, suggested, sent, snoozed, dismissed, failed. */
  @Column({ type: DataType.STRING(12), allowNull: false })
  status: string;

  /** One sentence for the admin: why this person is on the list. */
  @Column({ type: DataType.TEXT, allowNull: true })
  reason: string | null;

  /** JSON facts the rule found (shown as evidence, and given to Claude). */
  @Column({ type: DataType.TEXT, allowNull: false })
  evidence: string;

  @Column({ type: DataType.STRING(200), allowNull: true })
  subject: string | null;

  @Column({ type: DataType.STRING(200), allowNull: true })
  headline: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  body: string | null;

  @Column({ type: DataType.STRING(60), field: 'button_label', allowNull: true })
  buttonLabel: string | null;

  @Column({ type: DataType.STRING(300), field: 'button_url', allowNull: true })
  buttonUrl: string | null;

  @Column({
    type: DataType.BOOLEAN,
    field: 'auto',
    allowNull: false,
    defaultValue: false,
  })
  auto: boolean;

  @Column({ type: DataType.STRING(64), field: 'batch_id', allowNull: true })
  batchId: string | null;

  @Column({ type: DataType.DATE, field: 'snoozed_until', allowNull: true })
  snoozedUntil: Date | null;

  @Column({ type: DataType.DATE, field: 'sent_on', allowNull: true })
  sentOn: Date | null;

  @Column({ type: DataType.STRING(191), field: 'sent_by', allowNull: true })
  sentBy: string | null;

  /** First time the student used the app again after the email (within 14 days). */
  @Column({ type: DataType.DATE, field: 'returned_on', allowNull: true })
  returnedOn: Date | null;

  @Column({ type: DataType.STRING(300), allowNull: true })
  error: string | null;

  @Column({ type: DataType.DATE, field: 'created_on', allowNull: false })
  createdOn: Date;

  @Column({ type: DataType.DATE, field: 'updated_on', allowNull: false })
  updatedOn: Date;
}

/** Per-rule settings: on or off, and whether its emails go out without review. */
@Table({ tableName: 'follow_up_rule' })
export class FollowUpRuleModel extends Model<FollowUpRuleModel> {
  @Column({ type: DataType.STRING(32), primaryKey: true })
  rule: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  enabled: boolean;

  @Column({
    type: DataType.BOOLEAN,
    field: 'auto_send',
    allowNull: false,
    defaultValue: false,
  })
  autoSend: boolean;

  @Column({ type: DataType.STRING(191), field: 'updated_by', allowNull: true })
  updatedBy: string | null;

  @Column({ type: DataType.DATE, field: 'updated_on', allowNull: false })
  updatedOn: Date;
}

/** A student's own rating of a chat answer, a test, or Easy Read. */
@Table({
  tableName: 'student_feedback',
  indexes: [
    {
      name: 'student_feedback_item',
      unique: true,
      fields: ['user_id', 'kind', 'item_id'],
    },
    { name: 'student_feedback_kind_created', fields: ['kind', 'created_on'] },
  ],
})
export class StudentFeedbackModel extends Model<StudentFeedbackModel> {
  @Column({ type: DataType.STRING(36), primaryKey: true })
  id: string;

  @Column({ type: DataType.STRING(36), field: 'user_id', allowNull: false })
  userId: string;

  /** chat_answer | test | easy_read */
  @Column({ type: DataType.STRING(16), allowNull: false })
  kind: string;

  /** The chat message, the test, or the document. */
  @Column({ type: DataType.STRING(64), field: 'item_id', allowNull: false })
  itemId: string;

  /** 1 = helpful, -1 = not helpful. */
  @Column({ type: DataType.TINYINT, allowNull: false })
  rating: number;

  @Column({ type: DataType.STRING(500), allowNull: true })
  comment: string | null;

  @Column({ type: DataType.DATE, field: 'created_on', allowNull: false })
  createdOn: Date;
}

/** Which admin opened which student's conversation, test or document, and when. */
@Table({
  tableName: 'admin_view',
  indexes: [{ name: 'admin_view_on', fields: ['viewed_on'] }],
})
export class AdminViewModel extends Model<AdminViewModel> {
  @Column({ type: DataType.STRING(36), primaryKey: true })
  id: string;

  @Column({
    type: DataType.STRING(191),
    field: 'admin_email',
    allowNull: false,
  })
  adminEmail: string;

  /** conversation | test | document */
  @Column({ type: DataType.STRING(16), allowNull: false })
  kind: string;

  @Column({ type: DataType.STRING(64), field: 'item_key', allowNull: false })
  itemKey: string;

  @Column({ type: DataType.STRING(36), field: 'user_id', allowNull: true })
  userId: string | null;

  @Column({ type: DataType.DATE, field: 'viewed_on', allowNull: false })
  viewedOn: Date;
}

/** Background jobs: a lock so only one server runs each, and when each last ran. */
@Table({ tableName: 'insights_job' })
export class InsightsJobModel extends Model<InsightsJobModel> {
  @Column({ type: DataType.STRING(40), primaryKey: true })
  name: string;

  @Column({ type: DataType.STRING(64), allowNull: true })
  holder: string | null;

  @Column({ type: DataType.DATE, field: 'locked_until', allowNull: true })
  lockedUntil: Date | null;

  @Column({ type: DataType.DATE, field: 'last_run_on', allowNull: true })
  lastRunOn: Date | null;
}

/** English translations of chat messages (and Claude's quotes), made once and kept. */
@Table({
  tableName: 'ai_translation',
  indexes: [
    { name: 'ai_translation_item', unique: true, fields: ['item_key', 'lang'] },
  ],
})
export class AiTranslationModel extends Model<AiTranslationModel> {
  @Column({ type: DataType.STRING(36), primaryKey: true })
  id: string;

  /** A document_message id, or "quote:<ai_label id>". */
  @Column({ type: DataType.STRING(80), field: 'item_key', allowNull: false })
  itemKey: string;

  @Column({ type: DataType.STRING(8), allowNull: false })
  lang: string;

  /** The language it was written in, as Claude named it ("Hindi"). */
  @Column({ type: DataType.STRING(60), allowNull: false })
  source: string;

  /** The translation; empty when it was already in English. */
  @Column({ type: DataType.TEXT('medium'), allowNull: false })
  text: string;

  @Column({ type: DataType.STRING(40), allowNull: false })
  model: string;

  @Column({
    type: DataType.INTEGER,
    field: 'input_tokens',
    allowNull: false,
    defaultValue: 0,
  })
  inputTokens: number;

  @Column({
    type: DataType.INTEGER,
    field: 'output_tokens',
    allowNull: false,
    defaultValue: 0,
  })
  outputTokens: number;

  @Column({ type: DataType.DATE, field: 'created_on', allowNull: false })
  createdOn: Date;
}

/** Something Claude suggests the team builds or changes, from what students run into. */
@Table({
  tableName: 'ai_idea',
  indexes: [{ name: 'ai_idea_status', fields: ['status', 'created_on'] }],
})
export class AiIdeaModel extends Model<AiIdeaModel> {
  @Column({ type: DataType.STRING(36), primaryKey: true })
  id: string;

  /** Ideas written together share a run. */
  @Column({ type: DataType.STRING(36), field: 'run_id', allowNull: false })
  runId: string;

  @Column({ type: DataType.STRING(200), allowNull: false })
  title: string;

  @Column({ type: DataType.STRING(20), allowNull: false })
  area: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  problem: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  proposal: string;

  @Column({ type: DataType.TEXT, field: 'first_step', allowNull: false })
  firstStep: string;

  @Column({ type: DataType.STRING(10), allowNull: false })
  impact: string;

  @Column({ type: DataType.STRING(10), allowNull: false })
  effort: string;

  @Column({
    type: DataType.INTEGER,
    field: 'students_affected',
    allowNull: false,
    defaultValue: 0,
  })
  studentsAffected: number;

  /** JSON: string[] of facts with numbers. */
  @Column({ type: DataType.TEXT, allowNull: false })
  evidence: string;

  /** JSON: [{ kind, key, quote, summary }] real examples behind it. */
  @Column({ type: DataType.TEXT, allowNull: false })
  examples: string;

  /** new | planned | done | dismissed | replaced (a newer run superseded it). */
  @Column({ type: DataType.STRING(12), allowNull: false, defaultValue: 'new' })
  status: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  note: string | null;

  @Column({ type: DataType.STRING(190), field: 'status_by', allowNull: true })
  statusBy: string | null;

  @Column({ type: DataType.STRING(40), allowNull: false })
  model: string;

  @Column({ type: DataType.DATE, field: 'created_on', allowNull: false })
  createdOn: Date;

  @Column({ type: DataType.DATE, field: 'updated_on', allowNull: false })
  updatedOn: Date;
}

export { AppEventModel } from '../telemetry/AppEventModel';
import { AppEventModel } from '../telemetry/AppEventModel';

export const INSIGHTS_MODELS = [
  AiLabelModel,
  AiBatchModel,
  AiDigestModel,
  FollowUpModel,
  FollowUpRuleModel,
  StudentFeedbackModel,
  AdminViewModel,
  InsightsJobModel,
  AiTranslationModel,
  AiIdeaModel,
  AppEventModel,
];
