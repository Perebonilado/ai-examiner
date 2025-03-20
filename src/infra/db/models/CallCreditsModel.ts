import {
  Table,
  Column,
  Model,
  DataType,
  BeforeCreate,
  ForeignKey,
} from 'sequelize-typescript';
import { generateUUID } from 'src/utils';
import { UserModel } from './UserModel';
import * as moment from 'moment';

@Table({ tableName: 'call_credits' })
export class CallCreditsModel extends Model<CallCreditsModel> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.BIGINT,
    field: 'remaining_time_ms',
  })
  remainingTimeMs: number;

  @Column({
    type: DataType.BIGINT,
    field: 'total_time_purchased_ms',
  })
  totalTimePurchasedMs: number;

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

  @BeforeCreate
  static addUUID(instance: CallCreditsModel) {
    instance.id = generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
