import { Module } from '@nestjs/common';
import { IntegrationsModule } from 'src/integrations/IntegrationsModule';
import { QuestionsController } from './controllers/QuestionsController';
import { AuthController } from './controllers/AuthController';

@Module({
  imports: [IntegrationsModule],
  controllers: [QuestionsController, AuthController],
})
export class InfraWebModule {}
