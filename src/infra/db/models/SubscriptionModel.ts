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

@Table({ tableName: 'subscriptions' })
export class SubscriptionModel extends Model<SubscriptionModel> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'subscription_code',
  })
  subscriptionCode: string

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
    field: 'modified_on',
    allowNull: true,
  })
  modifiedOn: Date;

  @BeforeCreate
  static addUUID(instance: SubscriptionModel) {
    instance.id = generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
