import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { drive_v3, google } from 'googleapis';
import { GoogleDriveUploadModel } from '../models/GoogleDriveModel';
import { Readable } from 'stream';
import { generateUUID, writeFileToStream } from 'src/utils';
import { tmpdir } from 'os';
import { unlink } from 'fs/promises';

@Injectable()
export class GoogleDriveService {
  constructor() {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(
        __dirname,
        '../config/service-account-google-drive.json',
      ),
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    this.drive = google.drive({ version: 'v3', auth });
  }

  private drive: drive_v3.Drive;

  public async uploadFile(
    file: Express.Multer.File,
  ): Promise<GoogleDriveUploadModel> {
    try {
      let tempFilePath: string | null;
      const tempFileName = `${generateUUID()}${path.extname(file.mimetype)}`;
      tempFilePath = path.join(tmpdir(), tempFileName);
      await writeFileToStream(tempFilePath, file.buffer);
      const fileStream = fs.createReadStream(tempFilePath, { autoClose: true });

      const res = await this.drive.files.create({
        requestBody: {
          name: file.originalname,
          mimeType: 'application/vnd.google-apps.presentation',
        },
        media: {
          mimeType: file.mimetype,
          body: fileStream,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      if (tempFilePath && fs.existsSync(tempFilePath)) {
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

      const fileId = res.data.id;

      await this.drive.permissions.create({
        fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      return {
        fileId,
      };
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Google drive: upload error',
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async getFile(fileId: string) {
    try {
      const data = await this.drive.files.export(
        {
          fileId,
          mimeType: 'application/pdf',
        },
        { responseType: 'stream' },
      );

      return await this.streamToBuffer(data.data);
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Google drive: failed to get file',
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', (err) => reject(err));
    });
  }
}
