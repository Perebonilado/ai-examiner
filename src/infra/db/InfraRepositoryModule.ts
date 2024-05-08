import { Module } from '@nestjs/common';
import { InfraDbModule } from './InfraDbModule';
import { UserRepository } from 'src/business/repository/UserRepository';
import { UserSequelizeRepository } from './repository/UserSequelizeRepository';
import { CourseSequelizeRepository } from './repository/CourseSequelizeRepository';
import { CourseRepository } from 'src/business/repository/CourseRepository';
import { CourseDocumentRepository } from 'src/business/repository/CourseDocumentRepository';
import { CourseDocumentSequelizeRepository } from './repository/CourseDocumentSequelizeRepository';

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
  ],
  exports: [UserRepository, CourseRepository, CourseDocumentRepository],
})
export class InfraRepositoryModule {}
