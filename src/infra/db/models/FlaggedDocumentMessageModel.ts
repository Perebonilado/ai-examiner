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
import { DocumentMessageModel } from './DocumentMessageModel';

@Table({ tableName: 'flagged_document_message' })
export class FlaggedDocumentMessageModel extends Model<FlaggedDocumentMessageModel> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id: string;

  @ForeignKey(() => DocumentMessageModel)
  @Column({
    type: DataType.STRING,
    field: 'document_message_id',
    allowNull: false,
  })
  documentMessageId: string;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
  })
  createdOn: Date;

  @BeforeCreate
  static addUUID(instance: FlaggedDocumentMessageModel) {
    instance.id = generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
