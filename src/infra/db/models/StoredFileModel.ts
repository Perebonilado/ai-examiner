import {
  Table,
  Column,
  Model,
  DataType,
  BeforeCreate,
  ForeignKey,
} from 'sequelize-typescript';
import * as moment from 'moment';
import { generateUUID } from 'src/utils';
import { CourseDocumentModel } from './CourseDocumentModel';

@Table({ tableName: 'stored_files' })
export class StoredFileModel extends Model<StoredFileModel> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.STRING,
    field: 'original_file_id',
    allowNull: false,
  })
  originalFileId: string;

  @Column({
    type: DataType.TEXT('long'),
    field: 'modified_file_content',
    allowNull: true,
  })
  modifiedContent: string;

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
  })
  createdOn: Date;

  @BeforeCreate
  static addUUID(instance: StoredFileModel) {
    instance.id = generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
