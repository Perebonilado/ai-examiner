import {
  Table,
  Column,
  Model,
  DataType,
  BeforeCreate,
  ForeignKey,
  HasMany,
} from 'sequelize-typescript';
import * as moment from 'moment';
import { generateUUID } from 'src/utils';
import { QuestionModel } from './QuestionModel';
import { UserModel } from './UserModel';
import { CourseDocumentModel } from './CourseDocumentModel';

@Table({ tableName: 'score' })
export class ScoreModel extends Model<ScoreModel> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.INTEGER,
    field: 'percentage_score',
    allowNull: false,
  })
  score: number;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
  })
  createdOn: Date;

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

  @ForeignKey(() => CourseDocumentModel)
  @Column({
    type: DataType.STRING,
    field: 'document_id',
    allowNull: false,
  })
  documentId: string;

  @BeforeCreate
  static addUUID(instance: ScoreModel) {
    instance.id = generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
