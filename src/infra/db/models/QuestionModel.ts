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
import { CourseDocumentModel } from './CourseDocumentModel';

@Table({ tableName: 'question' })
export class QuestionModel extends Model<QuestionModel> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.JSON,
    allowNull: false,
    field: 'data',
  })
  data: string;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
  })
  createdOn: Date;

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
    field: 'course_document_id',
    allowNull: false,
  })
  courseDocumentId: string;

  @BeforeCreate
  static addUUID(instance: QuestionModel) {
    instance.id = generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate()
  }
}
