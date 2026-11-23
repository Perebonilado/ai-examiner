import {
  Table,
  Column,
  Model,
  DataType,
  BeforeCreate,
  ForeignKey,
  AllowNull,
} from 'sequelize-typescript';
import { generateUUID } from 'src/utils';
import * as moment from 'moment';
import { UserModel } from './UserModel';
import { QuestionModel } from './QuestionModel';
import { QuestionProgressStatusType } from 'src/infra/web/models/QuestionProgressStatusType';

// For the admin pages: each person's latest answer from the index alone, and date ranges of activity.
@Table({
  tableName: 'question_progress',
  indexes: [
    {
      name: 'question_progress_user_id_modified_on',
      fields: ['user_id', 'modified_on'],
    },
    {
      name: 'question_progress_modified_on_user_id',
      fields: ['modified_on', 'user_id'],
    },
    // The admin's test pages find each test's attempts.
    {
      name: 'question_progress_question_id_user_id',
      fields: ['question_id', 'user_id'],
    },
  ],
})
export class QuestionProgressModel extends Model<QuestionProgressModel> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.JSON,
    allowNull: true,
    field: 'data',
  })
  data: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'status',
  })
  status: QuestionProgressStatusType;

  @ForeignKey(() => QuestionModel)
  @Column({
    type: DataType.STRING,
    field: 'question_id',
    allowNull: false,
  })
  questionId: string;

  @ForeignKey(() => UserModel)
  @Column({
    type: DataType.STRING,
    field: 'user_id',
    allowNull: false,
  })
  userId: string;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
  })
  createdOn: Date;

  @Column({
    type: DataType.DATE,
    field: 'modified_on',
    allowNull: true,
  })
  modifiedOn: Date;

  @BeforeCreate
  static addUUID(instance: QuestionProgressModel) {
    instance.id = generateUUID();
    instance.status = 'in_progress';
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
