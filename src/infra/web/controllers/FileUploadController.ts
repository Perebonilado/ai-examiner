import {
  Controller,
  Post,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Inject,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { ExaminerService } from 'src/integrations/open-ai/services/ExaminerService';

@Controller('file-upload')
export class FileUploadController {
  constructor(
    @Inject(ExaminerService) private examinerService: ExaminerService,
  ) {}

  @UseGuards(AuthGuard)
  @Post('')
  @UseInterceptors(FileInterceptor('document'))
  public async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('pages') pages: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    try {
      const pdfPageRange =
        pages === 'custom' ? { start: Number(start), end: Number(end) } : {};
      const uploadedFile = await this.examinerService.uploadFile(
        file,
        pdfPageRange,
      );

      return {
        data: {
          fileId: uploadedFile.id,
        },
        message: 'File uploaded successfully',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HttpException(
        error || 'Failed to upload file',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
