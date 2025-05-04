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
import { FlaggedQuestionModel } from '../models/FlaggedQuestionsModel';
import { FlaggedDocumentMessageModel } from '../models/FlaggedDocumentMessageModel';
import { PreferredLanguageModel } from '../models/PreferredLanguageModel';
import { EssayQuestionAnalysisModel } from '../models/EssayQuestionAnalysisModel';
import { DocumentSummaryModel } from '../models/DocumentSummaryModel';
import { RelatedVideoModel } from '../models/RelatedVideoModel';

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
        FlaggedQuestionModel,
        FlaggedDocumentMessageModel,
        PreferredLanguageModel,
        EssayQuestionAnalysisModel,
        DocumentSummaryModel,
        RelatedVideoModel
      ]);

      try {
        await sequelize.sync();
        console.log('Database synced successfully');
      } catch (error) {
        console.log(error);
      }

      return sequelize;
    },
  },
];
