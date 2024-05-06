import {
  Table,
  Column,
  Model,
  DataType,
  BeforeCreate,
  ForeignKey,
} from 'sequelize-typescript';
import { generateUUID } from 'src/utils';
import { LookUpModel } from './LookUpModel';

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
    allowNull: false,
    field: 'password',
  })
  password: string;

  @ForeignKey(() => LookUpModel)
  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'institution',
  })
  institution: string;

  @BeforeCreate
  static addUUID(instance: UserModel) {
    instance.id = generateUUID();
  }
}
