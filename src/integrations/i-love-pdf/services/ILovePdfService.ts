import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { TaskModel } from '../models/TaskModel';
import { ToolType } from '../models/ToolModel';
import {
  FileModel,
  FileUploadModel,
  UploadFilePayloadModel,
} from '../models/FileUploadModel';
import {
  ProcessFileModel,
  ProcessFilePayloadModel,
} from '../models/ProcessFileModel';
import { EnvironmentVariables } from 'src/EnvironmentVariables';

@Injectable()
export class ILovePdfService {
  constructor(private httpService: HttpService) {}

  private baseUrl = `https://api.ilovepdf.com/v1`;
  private token = ``;

  public async authenticate(): Promise<string> {
    try {
      const { data } = await this.httpService.axiosRef.post(
        `${this.baseUrl}/auth`,
        {
          public_key: EnvironmentVariables.config.iLovePdfPublicKey,
        },
      );

      return data['token'];
    } catch (error) {
      throw new HttpException(
        'Failed to authenticate pdf lib',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  public async processFileBasedOnTool(
    file: FileModel,
    tool: ToolType,
    optionalArgs?: any,
  ): Promise<Buffer> {
    try {
      const token = await this.authenticate();
      this.token = token;
      const { server, task } = await this.startTask(tool);

      const uploadedFile = await this.uploadFile(server, {
        file,
        task: task,
      });

      const fileInfo = [
        {
          filename: file['originalname'] ?? 'file-to-upload',
          server_filename: uploadedFile.server_filename,
        },
      ];

      await this.processFile(
        server,
        {
          files: fileInfo,
          task,
          tool,
        },
        optionalArgs,
      );

      const processedFile = await this.downloadFile(server, task);

      return processedFile;
    } catch (error) {
      throw new HttpException(
        'Failed to process file',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async startTask(tool: ToolType): Promise<TaskModel> {
    try {
      const { data: task } = await this.httpService.axiosRef.get(
        `${this.baseUrl}/start/${tool}`,
        { headers: { Authorization: `Bearer ${this.token}` } },
      );

      return task;
    } catch (error) {
      throw new HttpException(
        'Failed to start pdf processing task',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async uploadFile(
    server: string,
    payload: UploadFilePayloadModel,
  ): Promise<FileUploadModel> {
    try {
      const formData = new FormData();
      formData.append('task', payload.task);

      // Create a blob from the Multer file buffer
      const blob = new Blob([payload.file.buffer], {
        type: payload.file.mimetype,
      });

      // Append file to FormData with original filename
      formData.append('file', blob, payload.file.originalname);

      const config = {
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'multipart/form-data',
        },
      };

      const { data } = await this.httpService.axiosRef.post(
        `https://${server}/v1/upload`,
        formData,
        config,
      );

      return data;
    } catch (error) {
      throw new HttpException(
        'Failed to upload file for processing',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async processFile(
    server: string,
    payload: ProcessFilePayloadModel,
    optionalArgs?: any,
  ): Promise<ProcessFileModel> {
    try {
      const { data } = await this.httpService.axiosRef.post(
        `https://${server}/v1/process`,
        { ...payload, ...optionalArgs },
        { headers: { Authorization: `Bearer ${this.token}` } },
      );

      return data;
    } catch (error) {
      throw new HttpException(
        'Failed to process uploaded file',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async downloadFile(server: string, task: string): Promise<Buffer> {
    try {
      const { data } = await this.httpService.axiosRef.get(
        `https://${server}/v1/download/${task}`,
        {
          headers: { Authorization: `Bearer ${this.token}` },
          responseType: 'arraybuffer',
        },
      );

      return Buffer.from(data);
    } catch (error) {
      throw new HttpException(
        'Failed to process download file',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
