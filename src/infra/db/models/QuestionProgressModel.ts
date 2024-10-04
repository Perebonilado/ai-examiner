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

@Table({ tableName: 'question_progress' })
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
