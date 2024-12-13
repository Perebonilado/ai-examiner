import { Injectable, Inject, HttpStatus } from '@nestjs/common';
import { PerformanceTrackingRepository } from 'src/business/repository/CreatePerformanceTrackingRepository';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreatePerformanceTrackingRequest } from '../request/CreatePerformanceTrackingRequest';
import { CreatePerformanceTrackingResponse } from '../response/CreatePerformanceTrackingResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { PerformanceTrackingModel } from 'src/infra/db/models/PerformanceTrackingModel';

@Injectable()
export class CreatePerformanceTrackingHandler extends AbstractRequestHandlerTemplate<
  CreatePerformanceTrackingRequest,
  CreatePerformanceTrackingResponse
> {
  constructor(
    @Inject(PerformanceTrackingRepository)
    private performanceTrackingRepository: PerformanceTrackingRepository,
  ) {
    super();
  }

  public async handleRequest(
    request: CreatePerformanceTrackingRequest,
  ): Promise<CommandResponse<CreatePerformanceTrackingResponse>> {
    try {
      const createdPerformanceTracking =
        await this.performanceTrackingRepository.create({
          ...request,
        } as PerformanceTrackingModel);

      return {
        data: {
          id: createdPerformanceTracking.id,
        },
        message: 'Performance tracking successfully created',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HandlerError(
        'Failed to handle performance tracking creation request',
      );
    }
  }
}
