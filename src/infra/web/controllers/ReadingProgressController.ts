import {
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
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';

@Controller('/reading-progress')
export class ReadingProgressController {
  constructor(
    @Inject(CreateDocumentReadingProgressHandler)
    private readonly createDocumentReadingProgressHandler: CreateDocumentReadingProgressHandler,
    @Inject(DeleteDocumentReadingProgressHandler)
    private readonly deleteDocumentReadingProgressHandler: DeleteDocumentReadingProgressHandler,
  ) {}

  @UseGuards(AuthGuard)
  @Post('')
  public async createReadingProgress() {
    try {
    } catch (error) {
      throw new HttpException(
        'Failed to get create progress',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Get('')
  public async getReadingProgress() {
    try {
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
    } catch (error) {
      throw new HttpException(
        'Failed to delete reading progress',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
