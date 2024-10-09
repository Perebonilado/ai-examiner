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
import { UserModel } from './UserModel';
import { QuestionModel } from './QuestionModel';
import { DocumentMessageModel } from './DocumentMessageModel';

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

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'course_id',
  })
  courseId: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: true,
    field: 'is_deleted',
    defaultValue: false,
  })
  isDeleted: boolean

  @ForeignKey(() => UserModel)
  @Column({
    type: DataType.STRING,
    field: 'user_id',
    allowNull: false,
  })
  userId: string;

  @Column({
    type: DataType.STRING,
    field: 'mcq_direct_thread_id',
    allowNull: true,
  })
  mcqDirectThreadId: string;
  
  @Column({
    type: DataType.STRING,
    field: 'mcq_use_case_thread_id',
    allowNull: true,
  })
  mcqUseCaseThreadId: string;

  @Column({
    type: DataType.STRING,
    field: 'flash_card_thread_id',
    allowNull: true,
  })
  flashCardThreadId: string;

  @Column({
    type: DataType.STRING,
    field: 'document_chat_thread_id',
    allowNull: true,
  })
  documentChatThreadId: string;

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
  })
  createdOn: Date;

  @HasMany(() => QuestionModel, 'course_document_id')
  question: QuestionModel;

  @HasMany(()=>DocumentMessageModel, 'course_document_id')
  documentMessage: DocumentMessageModel

  @BeforeCreate
  static addUUID(instance: CourseDocumentModel) {
    instance.id = generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
