import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
} from 'sequelize-typescript';
import * as moment from 'moment';
import { QuestionModel } from './QuestionModel';
import { DocumentTopicModel } from './DocumentTopicModel';

@Table({ tableName: 'question_topic' })
export class QuestionTopicModel extends Model<QuestionTopicModel> {
  @Column({
    type: DataType.BIGINT,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
    unique: true,
  })
  id: number;

  @Column({
    type: DataType.STRING,
    field: 'document_topic_title',
    allowNull: false,
  })
  documentTopicTitle: string;

  @ForeignKey(() => QuestionModel)
  @Column({
    type: DataType.STRING,
    field: 'question_id',
    allowNull: false,
  })
  questionId: string;

  @ForeignKey(() => DocumentTopicModel)
  @Column({
    type: DataType.BIGINT,
    field: 'document_topic_id',
    allowNull: false,
  })
  documentTopicId: number;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
    defaultValue: moment(new Date()).utc().toDate(),
  })
  createdOn: Date;
}
