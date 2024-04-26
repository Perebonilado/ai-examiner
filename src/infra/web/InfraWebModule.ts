import { Module } from '@nestjs/common';
import { IntegrationsModule } from 'src/integrations/IntegrationsModule';
import { QuestionsController } from './controllers/QuestionsController';

@Module({ imports: [IntegrationsModule], controllers: [QuestionsController] })
export class InfraWebModule {}
