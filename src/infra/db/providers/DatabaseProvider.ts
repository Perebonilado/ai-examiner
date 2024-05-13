import { Sequelize } from 'sequelize-typescript';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { UserModel } from '../models/UserModel';
import { LookUpModel } from '../models/LookUpModel';
import { CourseModel } from '../models/CourseModel';
import { CourseDocumentModel } from '../models/CourseDocumentModel';
import { QuestionModel } from '../models/QuestionModel';

export let sequelize: Sequelize;

export const databaseProviders = [
  {
    provide: 'SEQUELIZE',
    useFactory: async (): Promise<Sequelize> => {
      sequelize = new Sequelize(
        `mysql://${process.env.Database_Username}:${process.env.Database_Password}@${process.env.Database_Host}:${process.env.Database_Port}/defaultdb?ssl-mode=REQUIRED`,
        { define: { timestamps: false }, logging: false, logQueryParameters: false },
      );
      sequelize.addModels([
        UserModel,
        LookUpModel,
        CourseModel,
        CourseDocumentModel,
        QuestionModel,
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
