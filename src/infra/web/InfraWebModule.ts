import { Module } from '@nestjs/common';
import { IntegrationsModule } from 'src/integrations/IntegrationsModule';
import { QuestionsController } from './controllers/QuestionsController';
import { AuthController } from './controllers/AuthController';
import { BusinessModule } from 'src/business/BusinessModule';
import { JwtModule } from '@nestjs/jwt';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { AuthService } from '../auth/services/AuthService';
import { QueryModule } from 'src/query/QueryModule';

@Module({
  imports: [
    JwtModule.register({
      global: true,
    }),
    IntegrationsModule,
    BusinessModule,
    QueryModule,
  ],
  providers: [AuthService],
  controllers: [QuestionsController, AuthController],
})
export class InfraWebModule {}
