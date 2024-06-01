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
        QuestionTopicModel
      ]);

      try {
        await sequelize.sync();
        console.log('Database synced successfully')
      } catch (error) {
        console.log(error);
      }

      return sequelize;
    },
  },
];
