import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { CreateFlaggedMessageHandler } from 'src/business/handlers/FlaggedDocumentMessage/CreateFlaggedDocumentMessageHandler';
import { CreateFlaggedQuestionHandler } from 'src/business/handlers/FlaggedQuestion/CreateFlaggedQuestionHandler';
import { FlagDocumentMessageDto } from 'src/dto/FlagDocumentMessageDto';
import { FlagQuestionDto } from 'src/dto/FlagQuestionDto';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';

@Controller('flag-content')
export class FlagContentController {
  constructor(
    @Inject(CreateFlaggedQuestionHandler)
    private createFlaggedQuestionHandler: CreateFlaggedQuestionHandler,
    @Inject(CreateFlaggedMessageHandler)
    private createFlaggedMessageHandler: CreateFlaggedMessageHandler,
  ) {}

  @UseGuards(AuthGuard)
  @Post('question')
  public async flagQuestion(@Body() body: FlagQuestionDto) {
    try {
      return await this.createFlaggedQuestionHandler.handle({
        selectedQuestionId: body.selectedQuestionId,
        testId: body.testId,
      });
    } catch (error) {
      throw new HttpException(
        'Failed to flag question',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('document-message')
  public async flagDocumentMessage(@Body() body: FlagDocumentMessageDto) {
    try {
      return await this.createFlaggedMessageHandler.handle({
        documentMessageId: body.documentMessageId,
      });
    } catch (error) {
      throw new HttpException(
        'Failed to flag document message',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
