import { Injectable } from '@nestjs/common';
import { DatabaseError } from 'src/error-handlers/infra/DatabaseError';
import { QuestionModel } from '../models/QuestionModel';

@Injectable()
export class QuestionDbConnector {
  public async create(question: QuestionModel) {
    try {
      return await QuestionModel.create(question);
    } catch (error) {
      console.log(error)
      throw new DatabaseError('Failed to save questions').InnerError(error);
    }
  }

  public async delete(id: string) {
    try {
      const question = await QuestionModel.findOne({ where: { id } });
      return await question.destroy();
    } catch (error) {
      throw new DatabaseError('Failed to delete question').InnerError(error);
    }
  }

  public async deleteAllUserQuestionsData(userId: string) {
    try {
      return await QuestionModel.destroy({ where: { userId } });
    } catch (error) {
      throw new DatabaseError('Failed to delete all user questions').InnerError(
        error,
      );
    }
  }
}
