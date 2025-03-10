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
import { ExtractTextService } from 'src/integrations/text-extraction/services/ExtractTextService';

@Controller('file-upload')
export class FileUploadController {
  constructor(
    @Inject(ExtractTextService) private extractTextService: ExtractTextService,
  ) {}

  // @UseGuards(AuthGuard)
  // @Post('')
  // @UseInterceptors(FileInterceptor('document'))
  // public async uploadFile(
  //   @UploadedFile() file: Express.Multer.File,
  //   @Query('pages') pages: string,
  //   @Query('start') start: string,
  //   @Query('end') end: string,
  // ) {
  //   try {
  //     const pdfPageRange =
  //       pages === 'custom' ? { start: Number(start), end: Number(end) } : {};
  //     const uploadedFile = await this.examinerService.uploadFile(
  //       file,
  //       pdfPageRange,
  //     );

  //     return {
  //       data: {
  //         fileId: uploadedFile.id,
  //       },
  //       message: 'File uploaded successfully',
  //       status: HttpStatus.CREATED,
  //     };
  //   } catch (error) {
  //     throw new HttpException(
  //       error || 'Failed to upload file',
  //       HttpStatus.BAD_REQUEST,
  //     );
  //   }
  // }

  // @UseGuards(AuthGuard)
  @Post('')
  @UseInterceptors(FileInterceptor('document'))
  public async uploadFileV2(
    @UploadedFile() file: Express.Multer.File,
    @Query('pages') pages: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    try {
      const chunks = await this.extractTextService.getChunksBasedOnFileMimeType(file)
      return chunks
    } catch (error) {
      console.log(error);
      throw new HttpException(
        error ?? 'V2: Failed to upload file',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
