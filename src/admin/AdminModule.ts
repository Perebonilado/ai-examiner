import { Module } from '@nestjs/common';
import { IntegrationsModule } from 'src/integrations/IntegrationsModule';
import { ActivityController } from './controllers/ActivityController';
import { AdminController } from './controllers/AdminController';
import { CampaignController } from './controllers/CampaignController';
import { EmailPublicController } from './controllers/EmailPublicController';
import { AdminAnalyticsService } from './services/AdminAnalyticsService';
import { AdminStatsService } from './services/AdminStatsService';
import { AdminTeamService } from './services/AdminTeamService';
import { InsightsController } from './insights/InsightsController';
import { InsightsJobs } from './insights/InsightsJobs';
import { LabelService } from './insights/LabelService';
import { InsightsService } from './insights/InsightsService';
import { StudentDataController } from './insights/StudentDataController';
import { FollowUpController } from './insights/FollowUpController';
import { FollowUpService } from './insights/FollowUpService';
import {
  AskController,
  StudentFeedbackController,
} from './insights/AskController';
import { AskService } from './insights/AskService';
import { DigestService } from './insights/DigestService';
import { TranslateService } from './insights/TranslateService';
import { IdeasController, IdeasService } from './insights/IdeasService';
import {
  TelemetryAdminController,
  TelemetryController,
} from './telemetry/TelemetryController';
import { TelemetryService } from './telemetry/TelemetryService';
import { CampaignSender } from './services/CampaignSender';
import { CampaignService } from './services/CampaignService';
import { EmailLinkService } from './services/EmailLinkService';

/** The admin dashboard, marketing campaigns and the public email links. */
@Module({
  imports: [IntegrationsModule],
  providers: [
    AdminStatsService,
    AdminAnalyticsService,
    AdminTeamService,
    LabelService,
    InsightsJobs,
    InsightsService,
    FollowUpService,
    AskService,
    DigestService,
    TranslateService,
    IdeasService,
    TelemetryService,
    CampaignService,
    CampaignSender,
    EmailLinkService,
  ],
  controllers: [
    ActivityController,
    AdminController,
    CampaignController,
    EmailPublicController,
    InsightsController,
    StudentDataController,
    FollowUpController,
    AskController,
    StudentFeedbackController,
    IdeasController,
    TelemetryController,
    TelemetryAdminController,
  ],
})
export class AdminModule {}
