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
import { EssayQuestionAnalysisStatus } from 'src/infra/web/models/EssayQuestionAnalysisStatus';

@Table({ tableName: 'essay_question_analysis' })
export class EssayQuestionAnalysisModel extends Model<EssayQuestionAnalysisModel> {
  @Column({
    type: DataType.BIGINT,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
    unique: true,
  })
  id: number;

  @Column({
    type: DataType.TEXT('long'),
    allowNull: false,
    field: 'question',
  })
  question: string;

  @Column({
    type: DataType.TEXT('long'),
    allowNull: false,
    field: 'answer',
  })
  answer: string;

  @Column({
    type: DataType.TEXT('long'),
    allowNull: false,
    field: 'analysis',
  })
  analysis: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'status',
  })
  status: EssayQuestionAnalysisStatus;

  @Column({
    type: DataType.BIGINT,
    allowNull: true,
    field: 'score',
  })
  score: number;

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
  static addUUID(instance: EssayQuestionAnalysisModel) {
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
