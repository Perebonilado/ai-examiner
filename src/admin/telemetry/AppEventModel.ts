import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * One thing a student did in the app, sent by the app as it happens: a page view, an upload
 * starting or failing, a test left half-way, a slow reply, an error. Kept for a year.
 */
@Table({
  tableName: 'app_event',
  indexes: [
    { name: 'app_event_name_at', fields: ['name', 'at'] },
    { name: 'app_event_user_at', fields: ['user_id', 'at'] },
    { name: 'app_event_session', fields: ['session_id', 'at'] },
  ],
})
export class AppEventModel extends Model<AppEventModel> {
  @Column({ type: DataType.BIGINT, primaryKey: true, autoIncrement: true })
  id: number;

  /** The signed-in student, if any. */
  @Column({ type: DataType.STRING(36), field: 'user_id', allowNull: true })
  userId: string | null;

  /** A random id kept in the browser, so visits before signing in can be linked up. */
  @Column({ type: DataType.STRING(36), field: 'anon_id', allowNull: true })
  anonId: string | null;

  /** One visit: ends after 30 minutes away. */
  @Column({ type: DataType.STRING(36), field: 'session_id', allowNull: false })
  sessionId: string;

  @Column({ type: DataType.STRING(40), allowNull: false })
  name: string;

  /** The page it happened on, with ids replaced (/questions/view-questions/:id). */
  @Column({ type: DataType.STRING(200), allowNull: true })
  path: string | null;

  /** How long it took or lasted, in milliseconds, when that's the point of the event. */
  @Column({ type: DataType.INTEGER, allowNull: true })
  ms: number | null;

  /** JSON: small details (file type, test type, error reason…). */
  @Column({ type: DataType.TEXT, allowNull: true })
  props: string | null;

  /** When it happened in the browser (checked against the server's clock). */
  @Column({ type: DataType.DATE(3), allowNull: false })
  at: Date;

  @Column({ type: DataType.DATE, field: 'created_on', allowNull: false })
  createdOn: Date;
}
