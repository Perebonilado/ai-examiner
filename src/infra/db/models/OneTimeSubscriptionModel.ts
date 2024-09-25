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

@Table({ tableName: 'one_time_subscription' })
export class OneTimeSubscriptionModel extends Model<OneTimeSubscriptionModel> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'plan_code',
  })
  planCode: string;

  @ForeignKey(() => UserModel)
  @Column({
    type: DataType.STRING,
    field: 'user_id',
    allowNull: false,
  })
  userId: string;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
  })
  createdOn: Date;

  @Column({
    type: DataType.DATE,
    field: 'expires_on',
    allowNull: true,
  })
  expiresOn: Date;

  @BeforeCreate
  static addUUID(instance: OneTimeSubscriptionModel) {
    instance.id = generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
