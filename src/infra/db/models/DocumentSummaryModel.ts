import {
  Table,
  Column,
  Model,
  DataType,
  BeforeCreate,
  ForeignKey,
} from 'sequelize-typescript';
import { generateUUID } from 'src/utils';
import { UserModel } from './UserModel';
import { CourseDocumentModel } from './CourseDocumentModel';
import * as moment from 'moment';

@Table({ tableName: 'document_summary' })
export class DocumentSummaryModel extends Model<DocumentSummaryModel> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.TEXT('long'),
    allowNull: false,
    field: 'summary',
  })
  summary: string;

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

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
    defaultValue: moment(new Date()).utc().toDate(),
  })
  createdOn: Date;

  @BeforeCreate
  static addUUID(instance: DocumentSummaryModel) {
    instance.id = generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
