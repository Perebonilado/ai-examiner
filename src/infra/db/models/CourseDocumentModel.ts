import {
  Table,
  Column,
  Model,
  DataType,
  BeforeCreate,
  ForeignKey,
  HasMany,
  HasOne,
} from 'sequelize-typescript';
import * as moment from 'moment';
import { generateUUID } from 'src/utils';
import { UserModel } from './UserModel';
import { QuestionModel } from './QuestionModel';
import { DocumentMessageModel } from './DocumentMessageModel';
import { PerformanceTrackingModel } from './PerformanceTrackingModel';
import { DocumentSummaryModel } from './DocumentSummaryModel';
import { RelatedVideoModel } from './RelatedVideoModel';
import { StoredFileModel } from './StoredFileModel';

@Table({ tableName: 'course_document' })
export class CourseDocumentModel extends Model<CourseDocumentModel> {
  @Column({
    type: DataType.STRING,
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
    allowNull: true,
    field: 'course_id',
  })
  courseId: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: true,
    field: 'is_deleted',
    defaultValue: false,
  })
  isDeleted: boolean;

  @ForeignKey(() => UserModel)
  @Column({
    type: DataType.STRING,
    field: 'user_id',
    allowNull: false,
  })
  userId: string;

  // mcq direct
  @Column({
    type: DataType.STRING,
    field: 'mcq_direct_hard_thread_id',
    allowNull: true,
  })
  mcqDirectHardThreadId: string;

  @Column({
    type: DataType.STRING,
    field: 'mcq_direct_medium_thread_id',
    allowNull: true,
  })
  mcqDirectMediumThreadId: string;

  @Column({
    type: DataType.STRING,
    field: 'mcq_direct_easy_thread_id',
    allowNull: true,
  })
  mcqDirectEasyThreadId: string;

  // mcq use case

  @Column({
    type: DataType.STRING,
    field: 'mcq_use_case_hard_thread_id',
    allowNull: true,
  })
  mcqUseCaseHardThreadId: string;

  @Column({
    type: DataType.STRING,
    field: 'mcq_use_case_medium_thread_id',
    allowNull: true,
  })
  mcqUseCaseMediumThreadId: string;

  @Column({
    type: DataType.STRING,
    field: 'mcq_use_case_easy_thread_id',
    allowNull: true,
  })
  mcqUseCaseEasyThreadId: string;

  // flashcards

  @Column({
    type: DataType.STRING,
    field: 'flash_card_hard_thread_id',
    allowNull: true,
  })
  flashCardHardThreadId: string;

  @Column({
    type: DataType.STRING,
    field: 'flash_card_medium_thread_id',
    allowNull: true,
  })
  flashCardMediumThreadId: string;

  @Column({
    type: DataType.STRING,
    field: 'flash_card_easy_thread_id',
    allowNull: true,
  })
  flashCardEasyThreadId: string;

  // multiple true false

  @Column({
    type: DataType.STRING,
    field: 'multiple_true_false_hard_thread_id',
    allowNull: true,
  })
  multipleTrueFalseHardThreadId: string;

  @Column({
    type: DataType.STRING,
    field: 'multiple_true_false_medium_thread_id',
    allowNull: true,
  })
  multipleTrueFalseMediumThreadId: string;

  @Column({
    type: DataType.STRING,
    field: 'multiple_true_false_easy_thread_id',
    allowNull: true,
  })
  multipleTrueFalseEasyThreadId: string;

  //==============

  @Column({
    type: DataType.STRING,
    field: 'document_chat_thread_id',
    allowNull: true,
  })
  documentChatThreadId: string;

  @Column({
    type: DataType.STRING,
    field: 'oral_question_thread_id',
    allowNull: true,
  })
  oralQuestionThreadId: string;

  @Column({
    type: DataType.STRING,
    field: 'open_ai_file_id',
    allowNull: true,
  })
  openAiFileId: string;

  @Column({
    type: DataType.DATE,
    field: 'created_on',
    allowNull: true,
  })
  createdOn: Date;

  @HasMany(() => QuestionModel, 'course_document_id')
  question: QuestionModel;

  @HasMany(() => DocumentMessageModel, 'course_document_id')
  documentMessage: DocumentMessageModel;

  @HasMany(() => PerformanceTrackingModel, 'course_document_id')
  performanceTracking: PerformanceTrackingModel;

  @HasOne(() => RelatedVideoModel, 'document_id')
  relatedVideo: RelatedVideoModel;

  @HasOne(() => DocumentSummaryModel, 'document_id')
  documentSummary: DocumentSummaryModel;

  @HasOne(() => StoredFileModel, 'document_id')
  storedFile: StoredFileModel;

  @BeforeCreate
  static addUUID(instance: CourseDocumentModel) {
    instance.id = generateUUID();
    instance.createdOn = moment(new Date()).utc().toDate();
  }
}
