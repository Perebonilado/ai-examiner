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
    field: 'file_location',
    allowNull: false,
  })
  fileLocation: string;

  @Column({
    type: DataType.STRING,
    field: 'simplified_file_location',
    allowNull: true,
  })
  simplifiedFileLocation: string;

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
