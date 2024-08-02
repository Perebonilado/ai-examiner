import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({ tableName: 'plan_permission' })
export class PlanPermissionModel extends Model<PlanPermissionModel> {
  @Column({
    type: DataType.BIGINT,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
    unique: true,
  })
  id: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'plan_id',
  })
  planId: string;

  @Column({
    type: DataType.BIGINT,
    allowNull: false,
    field: 'permission_id',
  })
  permissionId: number;
}
