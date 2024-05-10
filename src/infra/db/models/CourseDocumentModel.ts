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
import { CourseModel } from './CourseModel';
import { UserModel } from './UserModel';
import { QuestionModel } from './QuestionModel';

@Table({ tableName: 'course_document' })
export class CourseDocumentModel extends Model<CourseDocumentModel> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'title',
  })
  title: string;

  @ForeignKey(() => CourseModel)
  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'course_id',
  })
  courseId: string;

  @ForeignKey(() => UserModel)
  @Column({
    type: DataType.STRING,
    field: 'user_id',
    allowNull: false,
  })
  userId: string;

  @Column({
    type: DataType.STRING,
    field: 'open_ai_thread_id',
    allowNull: false,
  })
  openAiThreadId: string;

  @Column({
    type: DataType.STRING,
    field: 'open_ai_file_id',
    allowNull: false,
  })
  openAiFileId: string;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
    defaultValue: moment(new Date()).utc().toDate(),
  })
  createdOn: Date;

  @HasMany(() => QuestionModel, 'course_document_id')
  question: QuestionModel;

  @BeforeCreate
  static addUUID(instance: CourseDocumentModel) {
    instance.id = generateUUID();
  }
}
