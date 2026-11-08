import {
  Table,
  Column,
  Model,
  DataType,
  BeforeCreate,
} from 'sequelize-typescript';
import * as moment from 'moment';
import { generateUUID } from 'src/utils';

export type SimplifiedPageStatus = 'pending' | 'running' | 'done' | 'failed';

/**
 * Easy Read: one row per page of a document. Holds the page's extracted text (saved at upload
 * or on first open) and, once simplified, the simplified content (JSON PDFContent[]). Pages are
 * simplified independently, so the reader can show each one as soon as it's ready.
 */
@Table({
  tableName: 'simplified_page',
  indexes: [{ unique: true, fields: ['document_id', 'page_number'] }],
})
export class SimplifiedPageModel extends Model<SimplifiedPageModel> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.STRING,
    field: 'document_id',
    allowNull: false,
  })
  documentId: string;

  /** 1-based. */
  @Column({
    type: DataType.INTEGER,
    field: 'page_number',
    allowNull: false,
  })
  pageNumber: number;

  @Column({
    type: DataType.STRING(16),
    field: 'status',
    allowNull: false,
    defaultValue: 'pending',
  })
  status: SimplifiedPageStatus;

  @Column({
    type: DataType.TEXT('long'),
    field: 'source_text',
    allowNull: true,
  })
  sourceText: string;

  /** JSON PDFContent[] once done. */
  @Column({
    type: DataType.TEXT('long'),
    field: 'content',
    allowNull: true,
  })
  content: string;

  @Column({
    type: DataType.INTEGER,
    field: 'attempts',
    allowNull: false,
    defaultValue: 0,
  })
  attempts: number;

  @Column({
    type: DataType.DATE,
    field: 'updated_on',
    allowNull: true,
  })
  updatedOn: Date;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
  })
  createdOn: Date;

  @BeforeCreate
  static addUUID(instance: SimplifiedPageModel) {
    instance.id = instance.id || generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
