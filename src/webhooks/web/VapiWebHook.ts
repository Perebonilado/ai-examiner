import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Res,
} from '@nestjs/common';
import { VapiCallEndedDto } from '../dto/VapiCallEndedDto';
import { Response } from 'express';
import { CreateOralQuestionAnalysisHandler } from 'src/business/handlers/OralQuestionAnalysis/CreateOralQuestionAnalysisHandler';
import { UpdateCallCreditsHandler } from 'src/business/handlers/CallCredits/UpdateCallCreditsHandler';
import { UserQueryService } from 'src/query/services/UserQueryService';

@Controller('webhook/vapi')
export class VapiWebhook {
  constructor(
    @Inject(CreateOralQuestionAnalysisHandler)
    private createOralQuestionAnalysisHandler: CreateOralQuestionAnalysisHandler,
    @Inject(UpdateCallCreditsHandler)
    private updateCallCreditHandler: UpdateCallCreditsHandler,
    @Inject(UserQueryService) private userQueryService: UserQueryService,
  ) {}

  @Post('')
  public async callEnded(
    @Body() body: VapiCallEndedDto,
    @Res() response: Response,
  ) {
    // acknowledge
    response.sendStatus(200);

    try {
      if (body.message.type === 'end-of-call-report') {
        const { customerEmail } = body.message.assistant
          .metadata as unknown as any;
        const user = await this.userQueryService.findOne(customerEmail);
        await this.updateCallCreditHandler.handle({
          action: 'subtract_remaining_time',
          timeToUpdate: body.message.durationMs,
          userId: user.id,
        });
        await this.createOralQuestionAnalysisHandler.handle({ data: body });
      }
    } catch (error) {
      throw new HttpException(
        'Failed to handle call ended request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
