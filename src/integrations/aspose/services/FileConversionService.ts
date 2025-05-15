import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { SlidesApi, ExportFormat } from 'asposeslidescloud';
import { WordsApi, ConvertDocumentRequest } from 'asposewordscloud';
import { createReadStream, existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { generateUUID, writeFileToStream } from 'src/utils';

@Injectable()
export class FileConversionService {
  constructor() {}

  public async convertSlide({
    buffer,
    extension,
    convertTo,
  }: {
    buffer: Buffer;
    extension: string;
    convertTo: ExportFormat;
  }) {
    try {
      const slidesApi = new SlidesApi(
        EnvironmentVariables.config.asposeClientId,
        EnvironmentVariables.config.asposeClientSecret,
      );
      const tempFileName = `${generateUUID()}.${extension}`;
      const tempFilePath = join(tmpdir(), tempFileName);

      await writeFileToStream(tempFilePath, buffer);
      const stream = createReadStream(tempFilePath, { autoClose: true });

      const converted = await slidesApi.convert(stream, convertTo);

      // Add a small delay before attempting to delete the file
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (tempFilePath && existsSync(tempFilePath)) {
        try {
          await unlink(tempFilePath);
        } catch (unlinkError) {
          console.warn(
            `Failed to delete temporary file: ${tempFilePath}`,
            unlinkError,
          );
          // Continue execution even if file deletion fails
        }
      }
      return converted.body;
    } catch (error) {
      throw new HttpException(
        error?.message ?? 'Failed to convert slides to pdf',
        error?.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }

  public async convertDocument({
    buffer,
    convertTo,
    extension,
  }: {
    buffer: Buffer;
    extension: string;
    convertTo: string;
  }) {
    try {
      const wordsApi = new WordsApi(
        EnvironmentVariables.config.asposeClientId,
        EnvironmentVariables.config.asposeClientSecret,
      );
      const tempFileName = `${generateUUID()}.${extension}`;
      const tempFilePath = join(tmpdir(), tempFileName);

      await writeFileToStream(tempFilePath, buffer);
      const stream = createReadStream(tempFilePath, { autoClose: true });
      const request = new ConvertDocumentRequest({
        format: convertTo,
        document: stream,
      });
      const converted = await wordsApi.convertDocument(request);
      // Add a small delay before attempting to delete the file
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (tempFilePath && existsSync(tempFilePath)) {
        try {
          await unlink(tempFilePath);
        } catch (unlinkError) {
          console.warn(
            `Failed to delete temporary file: ${tempFilePath}`,
            unlinkError,
          );
          // Continue execution even if file deletion fails
        }
      }
      return converted.body;
    } catch (error) {
      throw new HttpException(
        error?.message ?? 'Failed to convert docx to pdf',
        error?.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }
}
