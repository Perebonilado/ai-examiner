import { Injectable, Inject } from '@nestjs/common';
import { OralQuestionAnalysisRepository } from 'src/business/repository/OralQuestionAnalysisRepository';
import { OralQuestionAnalysisModel } from '../models/OralQuestionAnalysisModel';
import { OralQuestionAnalysisDbConnector } from '../connectors/OralQuestionAnalysisDbConnector';

@Injectable()
export class OralQuestionAnalysisSequelizeRepository
  implements OralQuestionAnalysisRepository
{
  constructor(
    @Inject(OralQuestionAnalysisDbConnector)
    private oralQuestionAnalysisDbConnector: OralQuestionAnalysisDbConnector,
  ) {}

  public async create(
    oralQuestionAnalysis: OralQuestionAnalysisModel,
  ): Promise<OralQuestionAnalysisModel> {
    return await this.oralQuestionAnalysisDbConnector.create(
      oralQuestionAnalysis,
    );
  }
}
