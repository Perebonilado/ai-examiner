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
import { QuestionModel } from './QuestionModel';

@Table({ tableName: 'flagged_question' })
export class FlaggedQuestionModel extends Model<FlaggedQuestionModel> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id: string;

  @ForeignKey(() => QuestionModel)
  @Column({
    type: DataType.STRING,
    field: 'test_id',
    allowNull: false,
  })
  testId: string;

  @Column({
    type: DataType.STRING,
    field: 'selected_question_id',
    allowNull: false,
  })
  selectedQuestionId: string;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
  })
  createdOn: Date;

  @BeforeCreate
  static addUUID(instance: FlaggedQuestionModel) {
    instance.id = generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
