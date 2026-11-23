import {
  UserActivityModel,
  EasyReadReadingHourModel,
  EasyReadReadingModel,
  UserDailyActiveModel,
  UserPresenceModel,
} from 'src/admin/models/ActivityModels';
import { AdminMemberModel } from 'src/admin/models/AdminMemberModel';
import { INSIGHTS_MODELS } from 'src/admin/insights/models';
import {
  EmailPreferenceModel,
  MarketingCampaignModel,
  MarketingClickModel,
  MarketingRecipientModel,
} from 'src/admin/models/CampaignModels';
import { Sequelize } from 'sequelize-typescript';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { UserModel } from '../models/UserModel';
import { LookUpModel } from '../models/LookUpModel';
import { CourseModel } from '../models/CourseModel';
import { CourseDocumentModel } from '../models/CourseDocumentModel';
import { QuestionModel } from '../models/QuestionModel';
import { ScoreModel } from '../models/ScoreModel';
import { DocumentTopicModel } from '../models/DocumentTopicModel';
import { QuestionTopicModel } from '../models/QuestionTopicModel';
import { SubscriptionModel } from '../models/SubscriptionModel';
import { PermissionModel } from '../models/PermissionsModel';
import { PlanPermissionModel } from '../models/PlanPermissionModel';
import { DocumentMessageModel } from '../models/DocumentMessageModel';
import { OneTimeSubscriptionModel } from '../models/OneTimeSubscriptionModel';
import { QuestionProgressModel } from '../models/QuestionProgressModel';
import { PerformanceTrackingModel } from '../models/PerformanceTrackingModel';
import { OralQuestionAnalysisModel } from '../models/OralQuestionAnalysisModel';
import { CallCreditsModel } from '../models/CallCreditsModel';
import { EasyReadUsageModel } from '../models/EasyReadUsageModel';
import { SimplifiedPageModel } from '../models/SimplifiedPageModel';
import { FlaggedQuestionModel } from '../models/FlaggedQuestionsModel';
import { FlaggedDocumentMessageModel } from '../models/FlaggedDocumentMessageModel';
import { PreferredLanguageModel } from '../models/PreferredLanguageModel';
import { EssayQuestionAnalysisModel } from '../models/EssayQuestionAnalysisModel';
import { DocumentSummaryModel } from '../models/DocumentSummaryModel';
import { RelatedVideoModel } from '../models/RelatedVideoModel';
import { StoredFileModel } from '../models/StoredFileModel';
import { DocumentReadingProgressModel } from '../models/DocumentReadingProgress';

export let sequelize: Sequelize;

export const databaseProviders = [
  {
    provide: 'SEQUELIZE',
    useFactory: async (): Promise<Sequelize> => {
      sequelize = new Sequelize({
        dialect: 'mysql',
        host: EnvironmentVariables.config.databaseHost,
        port: EnvironmentVariables.config.databasePort,
        username: EnvironmentVariables.config.databaseUsername,
        password: EnvironmentVariables.config.databasePassword,
        database: EnvironmentVariables.config.database,
        logging: false,
        logQueryParameters: false,
        define: { timestamps: false },
      });
      sequelize.addModels([
        UserModel,
        LookUpModel,
        CourseModel,
        CourseDocumentModel,
        QuestionModel,
        ScoreModel,
        DocumentTopicModel,
        QuestionTopicModel,
        SubscriptionModel,
        PermissionModel,
        PlanPermissionModel,
        DocumentMessageModel,
        OneTimeSubscriptionModel,
        QuestionProgressModel,
        PerformanceTrackingModel,
        OralQuestionAnalysisModel,
        CallCreditsModel,
        EasyReadUsageModel,
        SimplifiedPageModel,
        FlaggedQuestionModel,
        FlaggedDocumentMessageModel,
        PreferredLanguageModel,
        EssayQuestionAnalysisModel,
        DocumentSummaryModel,
        RelatedVideoModel,
        StoredFileModel,
        DocumentReadingProgressModel,
        UserActivityModel,
        UserPresenceModel,
        UserDailyActiveModel,
        EasyReadReadingModel,
        EasyReadReadingHourModel,
        AdminMemberModel,
        ...INSIGHTS_MODELS,
        MarketingCampaignModel,
        MarketingRecipientModel,
        MarketingClickModel,
        EmailPreferenceModel,
      ]);

      try {
        await sequelize.sync();
        console.log('Database synced successfully');
      } catch (error) {
        console.log(error);
      }
      await addEmailConfirmationColumns(sequelize);

      return sequelize;
    },
  },
];

/**
 * sync() never changes an existing table, so the email-confirmation columns are added here, once.
 * The column defaults to 1 (confirmed): every existing account, and any account made by code that
 * doesn't know about confirmation, counts as confirmed. Only email sign-ups set it to 0.
 */
async function addEmailConfirmationColumns(sequelize: Sequelize) {
  try {
    const [rows] = (await sequelize.query(
      `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME IN ('email_confirmed', 'email_confirmed_on')`,
    )) as [{ name: string }[], unknown];
    const have = new Set(rows.map((r) => r.name));
    const run = async (sql: string) => {
      try {
        await sequelize.query(sql);
      } catch (error) {
        // Another instance added it first.
        if (!/Duplicate column/i.test(String(error?.message))) throw error;
      }
    };
    if (!have.has('email_confirmed'))
      await run(
        'ALTER TABLE `user` ADD COLUMN `email_confirmed` TINYINT(1) NOT NULL DEFAULT 1',
      );
    if (!have.has('email_confirmed_on'))
      await run(
        'ALTER TABLE `user` ADD COLUMN `email_confirmed_on` DATETIME NULL',
      );
    if (!have.has('email_confirmed') || !have.has('email_confirmed_on'))
      await sequelize.query(
        'UPDATE `user` SET `email_confirmed_on` = COALESCE(`created_on`, UTC_TIMESTAMP()) WHERE `email_confirmed` = 1 AND `email_confirmed_on` IS NULL',
      );
    console.log('Email confirmation columns ready');
  } catch (error) {
    console.error(
      'Could not add the email confirmation columns',
      error?.message,
    );
  }
}
