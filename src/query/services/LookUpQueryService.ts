import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { LookUpModel } from 'src/infra/db/models/LookUpModel';

@Injectable()
export class LookUpQueryService {
  public async findAllLookUpsByType(type: string) {
    try {
      return await LookUpModel.findAll({ where: { type } });
    } catch (error) {
      throw new QueryError('Failed to find look up by type').InnerError(error);
    }
  }

  public async findLookUpById(id: number) {
    try {
      return await LookUpModel.findOne({ where: { id } });
    } catch (error) {
      throw new QueryError('Failed to look up by id').InnerError(error);
    }
  }
}
