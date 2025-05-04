import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BeforeCreate,
} from 'sequelize-typescript';
import * as moment from 'moment';
import { CourseDocumentModel } from './CourseDocumentModel';
import { generateUUID } from 'src/utils';
import { RelatedVideoSourceType } from 'src/infra/web/models/RelatedVideoSourceType';

@Table({ tableName: 'related_video' })
export class RelatedVideoModel extends Model<RelatedVideoModel> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.JSON,
    allowNull: true,
    field: 'data',
  })
  data: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'source',
  })
  source: RelatedVideoSourceType;

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
  static addUUID(instance: RelatedVideoModel) {
    instance.id = generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
