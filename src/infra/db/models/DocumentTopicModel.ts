import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  HasOne,
} from 'sequelize-typescript';
import * as moment from 'moment';
import { CourseDocumentModel } from './CourseDocumentModel';
import { UserModel } from './UserModel';
import { DocumentReadingProgressModel } from './DocumentReadingProgress';

@Table({ tableName: 'document_topic' })
export class DocumentTopicModel extends Model<DocumentTopicModel> {
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
    allowNull: false,
    field: 'title',
  })
  title: string;

  @Column({
    type: DataType.BIGINT,
    allowNull: true,
    field: 'startPage',
  })
  startPage: number;

  @Column({
    type: DataType.BIGINT,
    allowNull: true,
    field: 'endPage',
  })
  endPage: number;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'short_description',
  })
  shortDescription: string;

  @ForeignKey(() => CourseDocumentModel)
  @Column({
    type: DataType.STRING,
    field: 'document_id',
    allowNull: false,
  })
  documentId: string;

  @ForeignKey(() => UserModel)
  @Column({
    type: DataType.STRING,
    field: 'user_id',
    allowNull: false,
  })
  userId: string;

  @HasOne(() => DocumentReadingProgressModel, 'document_topic_id')
  readingProgress: DocumentReadingProgressModel;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
    defaultValue: moment(new Date()).utc().toDate(),
  })
  createdOn: Date;
}
