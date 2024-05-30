import { Module } from '@nestjs/common';
import { InfraDbModule } from './InfraDbModule';
import { UserRepository } from 'src/business/repository/UserRepository';
import { UserSequelizeRepository } from './repository/UserSequelizeRepository';
import { CourseSequelizeRepository } from './repository/CourseSequelizeRepository';
import { CourseRepository } from 'src/business/repository/CourseRepository';
import { CourseDocumentRepository } from 'src/business/repository/CourseDocumentRepository';
import { CourseDocumentSequelizeRepository } from './repository/CourseDocumentSequelizeRepository';
import { QuestionRepository } from 'src/business/repository/QuestionRepository';
import { QuestionSequelizeRepository } from './repository/QuestionSequelizeRepository';
import { ScoreRepository } from 'src/business/repository/ScoreRepository';
import { ScoreSequelizeRepository } from './repository/ScoreSequelizeRepository';
import { DocumentTopicRepository } from 'src/business/repository/DocumentTopicRepository';
import { DocumentTopicSequelizeRepository } from './repository/DocumentTopicSequelizeRepository';
import { QuestionTopicRepository } from 'src/business/repository/QuestionTopicRepository';
import { QuestionTopicSequelizeRepository } from './repository/QuestionTopicSequelizeRepository';

@Module({
  imports: [InfraDbModule],
  providers: [
    {
      provide: UserRepository,
      useClass: UserSequelizeRepository,
    },
    {
      provide: CourseRepository,
      useClass: CourseSequelizeRepository,
    },
    {
      provide: CourseDocumentRepository,
      useClass: CourseDocumentSequelizeRepository,
    },
    {
      provide: QuestionRepository,
      useClass: QuestionSequelizeRepository,
    },
    {
      provide: ScoreRepository,
      useClass: ScoreSequelizeRepository,
    },
    {
      provide: DocumentTopicRepository,
      useClass: DocumentTopicSequelizeRepository,
    },
    {
      provide: QuestionTopicRepository,
      useClass: QuestionTopicSequelizeRepository
    }
  ],
  exports: [
    UserRepository,
    CourseRepository,
    CourseDocumentRepository,
    QuestionRepository,
    ScoreRepository,
    DocumentTopicRepository,
    QuestionTopicRepository
  ],
})
export class InfraRepositoryModule {}
