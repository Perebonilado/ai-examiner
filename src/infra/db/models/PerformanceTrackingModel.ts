import {
  Table,
  Column,
  Model,
  DataType,
  BeforeCreate,
  ForeignKey,
} from 'sequelize-typescript';
import { UserModel } from './UserModel';
import { generateUUID } from 'src/utils';
import * as moment from 'moment';
import { CourseDocumentModel } from './CourseDocumentModel';

@Table({ tableName: 'performance_tracking' })
export class PerformanceTrackingModel extends Model<PerformanceTrackingModel> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.DATE,
    field: 'start_date',
    allowNull: false,
  })
  startDate: Date;

  @Column({
    type: DataType.DATE,
    field: 'end_date',
    allowNull: false,
  })
  endDate: Date;

  @Column({
    type: DataType.JSON,
    allowNull: false,
    field: 'data',
  })
  data: string;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
  })
  createdOn: Date;

  @ForeignKey(() => CourseDocumentModel)
  @Column({
    type: DataType.STRING,
    field: 'course_document_id',
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

  @BeforeCreate
  static addUUID(instance: PerformanceTrackingModel) {
    instance.id = generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
