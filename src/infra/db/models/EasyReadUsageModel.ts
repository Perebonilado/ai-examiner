import {
  Table,
  Column,
  Model,
  DataType,
  BeforeCreate,
} from 'sequelize-typescript';
import * as moment from 'moment';
import { generateUUID } from 'src/utils';

/**
 * Easy Read time used per user per calendar month (UTC), for the free plan's monthly allowance.
 * One row per user per month. No foreign key on user_id, so `sequelize.sync()` can create the
 * table on deploy without depending on the user table's column type.
 */
@Table({
  tableName: 'easy_read_usage',
  indexes: [{ unique: true, fields: ['user_id', 'month'] }],
})
export class EasyReadUsageModel extends Model<EasyReadUsageModel> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.UUID,
    field: 'user_id',
    allowNull: false,
  })
  userId: string;

  /** Calendar month in UTC, "YYYY-MM". */
  @Column({
    type: DataType.STRING(7),
    field: 'month',
    allowNull: false,
  })
  month: string;

  @Column({
    type: DataType.INTEGER,
    field: 'seconds_used',
    allowNull: false,
    defaultValue: 0,
  })
  secondsUsed: number;

  @Column({
    type: DataType.DATE,
    field: 'last_active_on',
    allowNull: true,
  })
  lastActiveOn: Date;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
  })
  createdOn: Date;

  @BeforeCreate
  static addUUID(instance: EasyReadUsageModel) {
    instance.id = generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
