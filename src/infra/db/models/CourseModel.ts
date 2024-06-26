import {
  Table,
  Column,
  Model,
  DataType,
  BeforeCreate,
  HasMany,
  ForeignKey,
} from 'sequelize-typescript';
import { generateUUID } from 'src/utils';
import * as moment from 'moment';
import { CourseDocumentModel } from './CourseDocumentModel';
import { UserModel } from './UserModel';

@Table({ tableName: 'course' })
export class CourseModel extends Model<CourseModel> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
    field: 'title',
  })
  title: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'description',
  })
  description: string;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
  })
  createdOn: Date;

  @Column({
    type: DataType.UUID,
    field: 'created_by',
    allowNull: true,
  })
  createdBy: string;

  @Column({ type: DataType.DATE, field: 'modified_on', allowNull: true })
  modifiedOn: Date;

  @Column({ type: DataType.STRING, field: 'modified_by', allowNull: true })
  modifiedBy: string;

  @ForeignKey(() => UserModel)
  @Column({
    type: DataType.STRING,
    field: 'user_id',
    allowNull: false,
  })
  userId: string;

  @BeforeCreate
  static addUUID(instance: CourseModel) {
    instance.id = generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
