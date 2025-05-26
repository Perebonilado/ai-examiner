import {
  Table,
  Column,
  Model,
  DataType,
  BeforeCreate,
  ForeignKey,
  HasOne,
} from 'sequelize-typescript';
import { generateUUID } from 'src/utils';
import { UserModel } from './UserModel';
import { CourseDocumentModel } from './CourseDocumentModel';
import { MessageSenderModel } from 'src/infra/web/models/MessageSenderModel';
import * as moment from 'moment';
import { FlaggedDocumentMessageModel } from './FlaggedDocumentMessageModel';

@Table({ tableName: 'document_message' })
export class DocumentMessageModel extends Model<DocumentMessageModel> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    field: 'message',
  })
  message: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'sender',
  })
  sender: MessageSenderModel;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'image',
  })
  image: string;

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
    defaultValue: moment(new Date()).utc().toDate(),
  })
  createdOn: Date;

  @ForeignKey(() => CourseDocumentModel)
  @Column({
    type: DataType.STRING,
    field: 'course_document_id',
    allowNull: false,
  })
  courseDocumentId: string;

  @HasOne(() => FlaggedDocumentMessageModel, 'document_message_id')
  flaggedDocumentMessage: FlaggedDocumentMessageModel;

  @BeforeCreate
  static addUUID(instance: CourseDocumentModel) {
    instance.id = generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
