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
  ],
  exports: [
    UserRepository,
    CourseRepository,
    CourseDocumentRepository,
    QuestionRepository,
    ScoreRepository,
  ],
})
export class InfraRepositoryModule {}
