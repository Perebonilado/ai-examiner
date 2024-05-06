import {
  Table,
  Column,
  Model,
  DataType,
  BeforeCreate,
  HasMany,
} from 'sequelize-typescript';
import { generateUUID } from 'src/utils';
import * as moment from 'moment';
import { QuestionModel } from './QuestionModel';

@Table({ tableName: 'question_group' })
export class QuestionGroupModel extends Model<QuestionGroupModel> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
    defaultValue: moment(new Date()).utc().toDate(),
  })
  createdOn: Date;

  @HasMany(() => QuestionModel, 'question_group_id')
  question: QuestionModel;

  @BeforeCreate
  static addUUID(instance: QuestionGroupModel) {
    instance.id = generateUUID();
  }
}
