import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BeforeCreate,
} from 'sequelize-typescript';
import * as moment from 'moment';
import { DocumentTopicModel } from './DocumentTopicModel';
import { CourseDocumentModel } from './CourseDocumentModel';

@Table({ tableName: 'document_reading_progress' })
export class DocumentReadingProgressModel extends Model<DocumentReadingProgressModel> {
  @Column({
    type: DataType.BIGINT,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
    unique: true,
  })
  id: number;

  @ForeignKey(() => DocumentTopicModel)
  @Column({
    type: DataType.BIGINT,
    field: 'document_topic_id',
    allowNull: false,
  })
  topicId: number;

  @ForeignKey(()=>CourseDocumentModel)
  @Column({
    type: DataType.STRING,
    field: 'document_id',
    allowNull: false,
  })
  documentId: string

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
  })
  createdOn: Date;

  @BeforeCreate
  static addUUID(instance: DocumentReadingProgressModel) {
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
