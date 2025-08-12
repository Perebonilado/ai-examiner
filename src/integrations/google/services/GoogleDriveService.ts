import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { drive_v3, google } from 'googleapis';
import { GoogleDriveUploadModel } from '../models/GoogleDriveModel';
import { Readable } from 'stream';
import { generateUUID, writeFileToStream } from 'src/utils';
import { tmpdir } from 'os';
import { unlink } from 'fs/promises';
import { EnvironmentVariables } from 'src/EnvironmentVariables';

@Injectable()
export class GoogleDriveService {
  constructor() {
    //service acc
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(
        __dirname,
        '../config/service-account-google-drive.json',
      ),
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    this.driveServiceAcc = google.drive({ version: 'v3', auth });

    //ws acc
    const authWs = new google.auth.JWT({
      keyFile: path.join(
        __dirname,
        '../config/service-account-google-drive.json',
      ),
      scopes: ['https://www.googleapis.com/auth/drive'],
      subject: this.workSpaceEmail, // Workspace user email to impersonate
    });

    this.driveWorkSpace = google.drive({ version: 'v3', auth: authWs });
  }

  // older files are owned by the service account
  // newer files are owned by the workspace account
  private driveServiceAcc: drive_v3.Drive;
  private driveWorkSpace: drive_v3.Drive;
  private workSpaceEmail = EnvironmentVariables.config.adminEmail;

  public async uploadFile({
    file,
    mimetype,
    originalFileName,
    mimeTypeToSaveAs = 'application/vnd.google-apps.presentation',
  }: {
    file: Buffer;
    mimetype: string;
    originalFileName: string;
    mimeTypeToSaveAs?: string;
  }): Promise<GoogleDriveUploadModel> {
    try {
      let tempFilePath: string | null;
      const tempFileName = `${generateUUID()}${path.extname(mimetype)}`;
      tempFilePath = path.join(tmpdir(), tempFileName);
      await writeFileToStream(tempFilePath, file);
      const fileStream = fs.createReadStream(tempFilePath, { autoClose: true });

      const res = await this.driveWorkSpace.files.create({
        requestBody: {
          name: originalFileName,
          ...(mimeTypeToSaveAs.startsWith('application/vnd.google-apps')
            ? { mimeType: mimeTypeToSaveAs }
            : {}),
        },
        media: {
          mimeType: mimetype,
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

      await this.driveWorkSpace.permissions.create({
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
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  public async deleteFile(fileId: string) {
    try {
      const existingFile = this.driveServiceAcc.files.get({
        fileId,
        fields: 'owners(emailAddress)',
      });
      const owner = (await existingFile).data.owners[0].emailAddress;

      if (owner === this.workSpaceEmail) {
        return await this.driveWorkSpace.files.delete({ fileId });
      }

      return await this.driveServiceAcc.files.delete({ fileId });
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Google drive: failed to delete file',
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }

  public async getFile(fileId: string) {
    try {
      const data = await this.driveServiceAcc.files.get(
        {
          fileId,
          alt: 'media',
        },
        { responseType: 'stream' },
      );

      return await this.streamToBuffer(data.data);
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Google drive: failed to get file',
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }

  public async exportFileAsPDF(fileId: string) {
    try {
      const data = await this.driveServiceAcc.files.export(
        {
          fileId,
          mimeType: 'application/pdf',
        },
        { responseType: 'stream' },
      );

      return await this.streamToBuffer(data.data);
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Google drive: failed to export file',
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }

  public async getFileUrl(fileId: string): Promise<string> {
    try {
      const data = await this.driveServiceAcc.files.get({ fileId });
      return data.data.webViewLink;
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Google drive: failed to get file location',
        error.status ?? HttpStatus.BAD_REQUEST,
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
