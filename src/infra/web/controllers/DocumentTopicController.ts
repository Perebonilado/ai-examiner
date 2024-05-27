import {
  Controller,
  Get,
  Delete,
  Inject,
  HttpStatus,
  HttpException,
  UseGuards,
  Query,
  Req,
  Param,
} from '@nestjs/common';
import { DeleteDocumentTopicHandler } from 'src/business/handlers/DocumentTopic/DeleteDocumentTopicHandler';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { Request } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { DocumentTopicQueryService } from 'src/query/services/DocumentTopicQueryService';

@Controller('document-topic')
export class DocumentTopicController {
  constructor(
    @Inject(DeleteDocumentTopicHandler)
    private deleteDocumentTopicHandler: DeleteDocumentTopicHandler,
    @Inject(DocumentTopicQueryService)
    private documentTopicQueryService: DocumentTopicQueryService,
  ) {}

  @UseGuards(AuthGuard)
  @Get('')
  public async getAllDocumentTopics(
    @Query('documentId') documentId: string,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      return await this.documentTopicQueryService.findAllByDocumentTopicsByDocumentIdAndUserId(
        documentId,
        userToken.sub,
      );
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to find document topics',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Delete('/:id')
  public async deleteDocumentTopic(@Param('id') id: string) {
    try {
      return await this.deleteDocumentTopicHandler.handle({ payload: { id } });
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to delete document topics',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
