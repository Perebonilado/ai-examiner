import { Injectable } from '@nestjs/common';
import { Op, QueryTypes } from 'sequelize';
import QueryError from 'src/error-handlers/query/QueryError';
import { OralQuestionAnalysisModel } from 'src/infra/db/models/OralQuestionAnalysisModel';
import { QuestionModel } from 'src/infra/db/models/QuestionModel';
import * as moment from 'moment';

@Injectable()
export class OralQuestionAnalysisQueryService {
  public async findByQuestionId(questionId: string) {
    try {
      return await OralQuestionAnalysisModel.findOne({ where: { questionId } });
    } catch (error) {
      throw new QueryError(
        'Failed to find oral question analysis by question id ' + questionId,
      );
    }
  }

  public async countOralQuestionsGenratedForCurrentMonth(userId: string) {
    try {
      const startOfMonth = moment.utc(new Date()).startOf('month').toDate();
      const endOfMonth = moment.utc(new Date()).endOf('month').toDate();
      const data = (await OralQuestionAnalysisModel.sequelize.query(
        `
        SELECT * 
      FROM oral_question_analysis AS orq
      INNER JOIN question q ON orq.question_id = q.id
      WHERE q.user_id = :userId
      AND q.created_on BETWEEN :startOfMonth AND :endOfMonth;

        `,
        {
          replacements: { userId, startOfMonth, endOfMonth },
          type: QueryTypes.SELECT,
        },
      )) as unknown as any[];

      return data.length
    } catch (error) {
      console.log(error);
      throw new QueryError(
        'Failed to count viva questions for month',
      ).InnerError(error);
    }
  }
}
