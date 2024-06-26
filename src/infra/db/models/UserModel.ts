import {
  Table,
  Column,
  Model,
  DataType,
  BeforeCreate,
  HasMany,
} from 'sequelize-typescript';
import { generateUUID } from 'src/utils';
import * as moment from 'moment';
import { CourseModel } from './CourseModel';
import { CourseDocumentModel } from './CourseDocumentModel';
import { QuestionModel } from './QuestionModel';

@Table({ tableName: 'user' })
export class UserModel extends Model<UserModel> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'first_name',
  })
  firstName: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'last_name',
  })
  lastName: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'email',
    unique: true,
  })
  email: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'password',
  })
  password: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'institution',
  })
  institution: string;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
  })
  createdOn: Date;

  @Column({ type: DataType.DATE, field: 'modified_on', allowNull: true })
  modifiedOn: Date;

  @HasMany(() => CourseModel, 'user_id')
  course: CourseModel;

  @HasMany(() => CourseDocumentModel, 'user_id')
  courseDocument: CourseDocumentModel;

  @HasMany(() => QuestionModel, 'user_id')
  question: QuestionModel;

  @BeforeCreate
  static addUUID(instance: UserModel) {
    instance.id = generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
