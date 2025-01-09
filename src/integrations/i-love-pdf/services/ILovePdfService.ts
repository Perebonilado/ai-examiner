import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { TaskModel } from '../models/TaskModel';
import { ToolType } from '../models/ToolModel';
import {
  FileUploadModel,
  UploadFilePayloadModel,
} from '../models/FileUploadModel';
import {
  ProcessFileModel,
  ProcessFilePayloadModel,
} from '../models/ProcessFileModel';

@Injectable()
export class ILovePdfService {
  constructor(private httpService: HttpService) {}

  private baseUrl = `https://api.ilovepdf.com/v1`;
  private token = ``;

  public async processFileBasedOnTool(
    file: Express.Multer.File,
    tool: ToolType,
    optionalArgs?: any,
  ): Promise<ArrayBuffer> {
    try {
      const { server, task } = await this.startTask(tool);

      const uploadedFile = await this.uploadFile(server, {
        file,
        task: task,
      });

      const fileInfo = [
        {
          filename: file.filename,
          server_filename: uploadedFile.server_filename,
        },
      ];

      const fileProcessingInfo = await this.processFile(
        task,
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
        HttpStatus.INTERNAL_SERVER_ERROR,
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
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async uploadFile(
    server: string,
    payload: UploadFilePayloadModel,
  ): Promise<FileUploadModel> {
    try {
      const { data } = await this.httpService.axiosRef.post(
        `https://${server}/v1/upload`,
        { ...payload },
        { headers: { Authorization: `Bearer ${this.token}` } },
      );

      return data;
    } catch (error) {
      throw new HttpException(
        'Failed to upload file for processing',
        HttpStatus.INTERNAL_SERVER_ERROR,
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
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async downloadFile(
    server: string,
    task: string,
  ): Promise<ArrayBuffer> {
    try {
      const { data } = await this.httpService.axiosRef.get(
        `https://${server}/v1/download/${task}`,
        { headers: { Authorization: `Bearer ${this.token}` } },
      );

      return data;
    } catch (error) {
      throw new HttpException(
        'Failed to process download file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
