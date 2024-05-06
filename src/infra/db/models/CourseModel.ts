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
    field: 'description',
  })
  description: string;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
    defaultValue: moment(new Date()).utc().toDate(),
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

  @HasMany(() => CourseDocumentModel, 'course_id')
  courseDocument: CourseDocumentModel;

  @BeforeCreate
  static addUUID(instance: CourseModel) {
    instance.id = generateUUID();
  }
}
