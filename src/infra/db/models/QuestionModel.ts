import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BeforeCreate,
} from 'sequelize-typescript';
import { generateUUID } from 'src/utils';
import { QuestionGroupModel } from './QuestionGroupModel';

@Table({ tableName: 'question' })
export class QuestionModel extends Model<QuestionModel> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.JSON,
    allowNull: false,
    field: 'data',
  })
  data: string;

  @ForeignKey(() => QuestionGroupModel)
  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'question_group_id',
  })
  questionGroupId: string;

  @BeforeCreate
  static addUUID(instance: QuestionModel) {
    instance.id = generateUUID();
  }
}
