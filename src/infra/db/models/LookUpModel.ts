import {
  Table,
  Column,
  Model,
  DataType,
  BeforeCreate,
} from 'sequelize-typescript';
import { generateUUID } from 'src/utils';

@Table({ tableName: 'lookup' })
export class LookUpModel extends Model<LookUpModel> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
  })
  id: string;

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

  @BeforeCreate
  static addUUID(instance: LookUpModel) {
    instance.id = generateUUID();
  }
}
