import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BeforeCreate,
} from 'sequelize-typescript';
import { QuestionModel } from './QuestionModel';
import * as moment from 'moment';

@Table({ tableName: 'oral_question_analysis' })
export class OralQuestionAnalysisModel extends Model<OralQuestionAnalysisModel> {
  @Column({
    type: DataType.BIGINT,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
    unique: true,
  })
  id: string;

  @Column({
    type: DataType.STRING,
    field: 'call_id',
    allowNull: false,
  })
  callId: string;

  @Column({
    type: DataType.JSON,
    allowNull: false,
    field: 'analysis_data',
  })
  analysisData: string;

  @ForeignKey(() => QuestionModel)
  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'question_id',
  })
  questionId: string;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
  })
  createdOn: Date;

  @BeforeCreate
  static addUUID(instance: QuestionModel) {
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
