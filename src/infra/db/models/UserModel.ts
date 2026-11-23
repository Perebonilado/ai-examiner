import {
  Table,
  Column,
  Model,
  DataType,
  BeforeCreate,
  HasMany,
  HasOne,
} from 'sequelize-typescript';
import { generateUUID } from 'src/utils';
import * as moment from 'moment';
import { CourseModel } from './CourseModel';
import { CourseDocumentModel } from './CourseDocumentModel';
import { QuestionModel } from './QuestionModel';
import { SubscriptionModel } from './SubscriptionModel';
import { DocumentMessageModel } from './DocumentMessageModel';
import { OneTimeSubscriptionModel } from './OneTimeSubscriptionModel';
import { QuestionProgressModel } from './QuestionProgressModel';
import { PerformanceTrackingModel } from './PerformanceTrackingModel';
import { CallCreditsModel } from './CallCreditsModel';
import { UserRole } from 'src/infra/web/models/UserRole';

// For the admin pages: sign-ups by day.
@Table({
  tableName: 'user',
  indexes: [{ name: 'user_created_on', fields: ['created_on'] }],
})
export class UserModel extends Model<UserModel> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'first_name',
  })
  firstName: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'last_name',
  })
  lastName: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'email',
    unique: true,
  })
  email: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'password',
  })
  password: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'institution',
  })
  institution: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'role',
  })
  role: UserRole;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
  })
  createdOn: Date;

  /**
   * False while an email-and-password account waits for its owner to confirm the address.
   * Google and guest accounts don't need confirming; accounts from before confirmation existed
   * were all marked confirmed.
   */
  @Column({
    type: DataType.BOOLEAN,
    field: 'email_confirmed',
    allowNull: false,
    // Confirmed unless a sign-up by email says otherwise (it always does, explicitly).
    defaultValue: true,
  })
  emailConfirmed: boolean;

  @Column({ type: DataType.DATE, field: 'email_confirmed_on', allowNull: true })
  emailConfirmedOn: Date | null;

  @Column({ type: DataType.DATE, field: 'modified_on', allowNull: true })
  modifiedOn: Date;

  @HasMany(() => CourseModel, 'user_id')
  course: CourseModel;

  @HasMany(() => CourseDocumentModel, 'user_id')
  courseDocument: CourseDocumentModel;

  @HasMany(() => QuestionModel, 'user_id')
  question: QuestionModel;

  @HasMany(() => QuestionProgressModel, 'user_id')
  questionProgress: QuestionProgressModel;

  @HasOne(() => SubscriptionModel, 'user_id')
  subscription: SubscriptionModel;

  @HasMany(() => DocumentMessageModel, 'user_id')
  documentMessage: DocumentMessageModel;

  @HasOne(() => CallCreditsModel, 'user_id')
  callCredits: CallCreditsModel;

  @HasOne(() => OneTimeSubscriptionModel, 'user_id')
  oneTimeSubscription: OneTimeSubscriptionModel;

  @HasMany(() => PerformanceTrackingModel, 'user_id')
  performanceTracking: PerformanceTrackingModel;

  @BeforeCreate
  static addUUID(instance: UserModel) {
    instance.id = generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
