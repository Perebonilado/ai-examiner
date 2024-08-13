import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { PlanPermissionModel } from 'src/infra/db/models/PlanPermissionModel';

@Injectable()
export class PlanPermissionQueryService {
  public async findPlanPermissionByPlanId(planId: string) {
    try {
      return await PlanPermissionModel.findOne({ where: { planId } });
    } catch (error) {
      throw new QueryError(
        'Failed to find plan permission by plan id',
      ).InnerError(error);
    }
  }
}
