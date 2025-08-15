import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateDocumentReadingProgressHandler } from 'src/business/handlers/DocumentReadingProgress/CreateDocumentReadingProgressHandler';
import { DeleteDocumentReadingProgressHandler } from 'src/business/handlers/DocumentReadingProgress/DeleteDocumentReadingProgressHandler';
import { CreateReadingProgressDto } from 'src/dto/CreateReadingProgressDto';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { DocumentReadingProgressQueryService } from 'src/query/services/DocumentReadingProgressQueryService';

@Controller('/reading-progress')
export class ReadingProgressController {
  constructor(
    @Inject(CreateDocumentReadingProgressHandler)
    private readonly createDocumentReadingProgressHandler: CreateDocumentReadingProgressHandler,
    @Inject(DeleteDocumentReadingProgressHandler)
    private readonly deleteDocumentReadingProgressHandler: DeleteDocumentReadingProgressHandler,
    @Inject(DocumentReadingProgressQueryService)
    private readonly documentReadingProgressQueryService: DocumentReadingProgressQueryService,
  ) {}

  @UseGuards(AuthGuard)
  @Post('')
  public async createReadingProgress(@Body() dto: CreateReadingProgressDto) {
    try {
      return await this.createDocumentReadingProgressHandler.handle({
        documentId: dto.documentId,
        topicId: dto.topicId,
      });
    } catch (error) {
      throw new HttpException(
        'Failed to get create progress',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Get('/:documentId')
  public async getReadingProgress(@Param('documentId') documentId: string) {
    try {
      return await this.documentReadingProgressQueryService.findByDocumentId(
        documentId,
      );
    } catch (error) {
      throw new HttpException(
        'Failed to get reading progress',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Delete('/:id')
  public async deleteReadingProgress(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.deleteDocumentReadingProgressHandler.handle({ id });
    } catch (error) {
      throw new HttpException(
        'Failed to delete reading progress',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
