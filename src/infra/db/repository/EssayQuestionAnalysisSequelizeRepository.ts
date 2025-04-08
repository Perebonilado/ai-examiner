import { Injectable, Inject } from '@nestjs/common';
import { EssayQuestionAnalysisRepository } from 'src/business/repository/EssayQuestionAnalysisRepository';
import { EssayQuestionAnalysisDbConnector } from '../connectors/EssayQuestionAnalysisDbConnector';
import { EssayQuestionAnalysisModel } from '../models/EssayQuestionAnalysisModel';

@Injectable()
export class EssayQuestionAnalysisSequelizeRepository
  implements EssayQuestionAnalysisRepository
{
  constructor(
    @Inject(EssayQuestionAnalysisDbConnector)
    private dbConnector: EssayQuestionAnalysisDbConnector,
  ) {}

  public async create(
    model: EssayQuestionAnalysisModel,
  ): Promise<EssayQuestionAnalysisModel> {
    return await this.dbConnector.create(model);
  }

  public async update(
    model: EssayQuestionAnalysisModel,
  ): Promise<EssayQuestionAnalysisModel> {
    return await this.dbConnector.update(model);
  }
}
