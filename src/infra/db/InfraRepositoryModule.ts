import { Module } from '@nestjs/common';
import { InfraDbModule } from './InfraDbModule';
import { UserRepository } from 'src/business/repository/UserRepository';
import { UserSequelizeRepository } from './repository/UserSequelizeRepository';

@Module({
  imports: [InfraDbModule],
  providers: [
    {
      provide: UserRepository,
      useClass: UserSequelizeRepository,
    },
  ],
  exports: [UserRepository],
})
export class InfraRepositoryModule {}
