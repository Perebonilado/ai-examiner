import { Injectable } from '@nestjs/common';
import QueryError from 'src/error-handlers/query/QueryError';
import { PermissionModel } from 'src/infra/db/models/PermissionsModel';
import { PlanType } from 'src/infra/web/models/PlanTypeModel';

@Injectable()
export class PermissionQueryService {
  public async findPermissionById(id: string) {
    try {
      return await PermissionModel.findOne({ where: { id } });
    } catch (error) {
      throw new QueryError('Failed to find permission by id').InnerError(error);
    }
  }

  public async findPermissionByPlanType(planType: PlanType) {
    try {
      return await PermissionModel.findOne({ where: { planType } });
    } catch (error) {
      throw new QueryError('Failed to find permission by plan type').InnerError(
        error,
      );
    }
  }
}
