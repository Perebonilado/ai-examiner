import { Injectable } from '@nestjs/common';
import { QuestionTopicModel } from '../models/QuestionTopicModel';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';

@Injectable()
export class QuestionTopicDbConnector {
  constructor() {}

  public async bulkCreate(questionTopics: QuestionTopicModel[]) {
    try {
      return await QuestionTopicModel.bulkCreate(questionTopics, {
        updateOnDuplicate: ['documentTopicTitle', 'questionId'],
      });
    } catch (error) {
      throw new DatabaseError(
        'Failed to bulk create question topics',
      ).InnerError(error);
    }
  }

  public async bulkDelete(questionTopicIds: number[]) {
    try {
      return await QuestionTopicModel.destroy({
        where: { id: questionTopicIds },
      });
    } catch (error) {
      throw new DatabaseError(
        'Failed to bulk delete question topics',
      ).InnerError(error);
    }
  }
}
