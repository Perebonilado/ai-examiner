import {
  Table,
  Column,
  Model,
  DataType,
  BeforeCreate,
  ForeignKey,
  HasMany,
} from 'sequelize-typescript';
import { generateUUID } from 'src/utils';
import * as moment from 'moment';
import { UserModel } from './UserModel';
import { CourseDocumentModel } from './CourseDocumentModel';
import { OralQuestionAnalysisModel } from './OralQuestionAnalysisModel';
import { DifficultyType } from 'src/constants/QuestionGenerationPrompt';
import { FlaggedQuestionModel } from './FlaggedQuestionsModel';

// For the admin pages: (user_id, created_on) counts each person's tests and finds their latest
// one from the index alone; (created_on, user_id) reads a date range of activity;
// (created_on, question_type_id, user_id) counts each kind of test over a date range.
@Table({
  tableName: 'question',
  indexes: [
    { name: 'question_user_id_created_on', fields: ['user_id', 'created_on'] },
    { name: 'question_created_on_user_id', fields: ['created_on', 'user_id'] },
    {
      name: 'question_created_on_type_user',
      fields: ['created_on', 'question_type_id', 'user_id'],
    },
  ],
})
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

  @Column({
    type: DataType.BIGINT,
    allowNull: false,
    field: 'question_type_id',
  })
  questionTypeId: number;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
  })
  createdOn: Date;

  @Column({
    type: DataType.STRING,
    field: 'difficulty',
    allowNull: false,
  })
  difficulty: DifficultyType;

  @Column({
    type: DataType.BOOLEAN,
    field: 'is_case_study',
    allowNull: false,
  })
  isCaseStudy: boolean;

  @ForeignKey(() => UserModel)
  @Column({
    type: DataType.STRING,
    field: 'user_id',
    allowNull: false,
  })
  userId: string;

  @ForeignKey(() => CourseDocumentModel)
  @Column({
    type: DataType.STRING,
    field: 'course_document_id',
    allowNull: false,
  })
  courseDocumentId: string;

  @HasMany(() => OralQuestionAnalysisModel, 'question_id')
  oralQuestionAnalysis: OralQuestionAnalysisModel;

  @HasMany(() => FlaggedQuestionModel, 'test_id')
  flaggedQuestion: FlaggedQuestionModel;

  @BeforeCreate
  static addUUID(instance: QuestionModel) {
    instance.id = generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
