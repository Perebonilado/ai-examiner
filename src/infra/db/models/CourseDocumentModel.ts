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
import { CourseModel } from './CourseModel';

@Table({ tableName: 'course_document' })
export class CourseDocumentModel extends Model<CourseDocumentModel> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'title',
  })
  title: string;

  @ForeignKey(() => CourseModel)
  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'course_id',
  })
  courseId: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'file_location',
  })
  fileLocation: string;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
    defaultValue: moment(new Date()).utc().toDate(),
  })
  createdOn: Date;

  @BeforeCreate
  static addUUID(instance: CourseDocumentModel) {
    instance.id = generateUUID();
  }
}
