import { Inject, Injectable } from '@nestjs/common';
import { FlaggedQuestionRepository } from 'src/business/repository/FlaggedQuestionRepository';
import { FlaggedQuestionDbConnector } from '../connectors/FlaggedQuestionDbConnector';
import { FlaggedQuestionModel } from '../models/FlaggedQuestionsModel';

@Injectable()
export class FlaggedQuestionSequelizeRepository
  implements FlaggedQuestionRepository
{
  constructor(
    @Inject(FlaggedQuestionDbConnector)
    private flaggedQuestionDbConnector: FlaggedQuestionDbConnector,
  ) {}

  public async create(
    model: FlaggedQuestionModel,
  ): Promise<FlaggedQuestionModel> {
    return await this.flaggedQuestionDbConnector.create(model);
  }
}
