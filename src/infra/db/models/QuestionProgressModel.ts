import {
  Table,
  Column,
  Model,
  DataType,
  BeforeCreate,
  ForeignKey,
} from 'sequelize-typescript';
import { generateUUID } from 'src/utils';
import * as moment from 'moment';
import { UserModel } from './UserModel';
import { QuestionModel } from './QuestionModel';

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
  static addUUID(instance: QuestionModel) {
    instance.id = generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
