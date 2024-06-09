import {
  Table,
  Column,
  Model,
  DataType,
} from 'sequelize-typescript';

@Table({ tableName: 'lookup' })
export class LookUpModel extends Model<LookUpModel> {
  @Column({
    type: DataType.BIGINT,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
    unique: true,
  })
  id: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'title',
  })
  title: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'type',
  })
  type: string;
}
