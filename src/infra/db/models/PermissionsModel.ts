import { Table, Column, Model, DataType } from 'sequelize-typescript';
import { PlanType } from 'src/infra/web/models/PlanTypeModel';

@Table({ tableName: 'permission' })
export class PermissionModel extends Model<PermissionModel> {
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
    field: 'plan_type',
  })
  planType: PlanType;

  @Column({
    type: DataType.JSON,
    allowNull: false,
    field: 'permissions',
  })
  permissions: string;
}
