import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ScoreModel } from 'src/infra/db/models/ScoreModel';

@Injectable()
export class ScoreQueryService {
  constructor() {}

  public async findScoreByQuestionId(questionId: string) {
    try {
      return await ScoreModel.findOne({ where: { questionId } });
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve scores by question id ${questionId}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  public async findScoresByDocumentId(documentId: string) {
    try {
      return await ScoreModel.findAll({ where: { documentId } });
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve scores using document id ${documentId}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
