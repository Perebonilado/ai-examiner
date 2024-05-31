import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { QuestionTopicModel } from 'src/infra/db/models/QuestionTopicModel';

@Injectable()
export class QuestionTopicQueryService {
  constructor() {}

  public async findQuestionTopicsByQuestionId(questionId: string): Promise<QuestionTopicModel[]> {
    try {
      return await QuestionTopicModel.findAll({ where: { questionId } });
    } catch (error) {
      throw new HttpException(
        'Failed to find question topics',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
