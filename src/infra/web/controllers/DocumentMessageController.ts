import {
  Controller,
  Inject,
  Post,
  Body,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
  Get,
  Query,
  ParseIntPipe,
  Res,
  Param,
} from '@nestjs/common';
import { Request } from 'express';
import { CreateDocumentMessageHandler } from 'src/business/handlers/DocumentMessage/CreateDocumentMessageHandler';
import { CreateDocumentMessageDto } from 'src/dto/CreateDocumentMessageDto';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { DocumentMessageQueryService } from 'src/query/services/DocumentMessageQueryService';

@Controller('document-message')
export class DocumentMessageController {
  constructor(
    @Inject(CreateDocumentMessageHandler)
    private createDocumentMessageHandler: CreateDocumentMessageHandler,
    @Inject(DocumentMessageQueryService)
    private documentMessageQueryService: DocumentMessageQueryService,
  ) {}

  @UseGuards(AuthGuard)
  @Post('')
  public async createDocumentMessage(
    @Req() request: Request,
    @Body() body: CreateDocumentMessageDto,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;

      return await this.createDocumentMessageHandler.handle({
        payload: {
          ...body,
          userId: userToken.sub,
          responseFormat: body.responseFormat || 'indepth',
        },
      });
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to create document message',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Get('/:courseDocumentId')
  public async getUserDocumentMessages(
    @Param('courseDocumentId') courseDocumentId: string,
    @Query('limit', ParseIntPipe) limit: number = 5,
    @Query('lastMessageCreatedOn') lastMessageCreatedOn: Date,
  ) {
    try {
      return await this.documentMessageQueryService.findDocumentMessagesByCourseDocumentId(
        { courseDocumentId, limit, lastMessageCreatedOn },
      );
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to find document messages',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
