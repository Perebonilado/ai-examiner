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

@Table({ tableName: 'preferred_language' })
export class PreferredLanguageModel extends Model<PreferredLanguageModel> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'language',
  })
  language: string;

  @ForeignKey(() => UserModel)
  @Column({
    type: DataType.STRING,
    field: 'user_id',
    allowNull: false,
  })
  userId: string;

  @BeforeCreate
  static addUUID(instance: PreferredLanguageModel) {
    instance.id = generateUUID();
  }
}
