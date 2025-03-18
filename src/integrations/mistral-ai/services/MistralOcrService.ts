import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { MistralClient } from './MistralClient';
import fs from 'fs';
import { HttpService } from '@nestjs/axios';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { AxiosResponse } from 'axios';
import { UploadMistralFileModel } from '../models/UploadMistralFileModel';
import * as FormData from 'form-data';
import { Readable } from 'stream';

@Injectable()
export class MistralOcrService extends MistralClient {
  constructor(@Inject(HttpService) private httpService: HttpService) {
    super();
  }

  private baseUrl = 'https://api.mistral.ai/v1';

  public async processPdf(file: Express.Multer.File) {
    try {
      const uploadedPDf = await this.handleUploadForOCR(file);
      const signedUrl = await this.retrieveSignedUrl(uploadedPDf.id);
      const processedPDFTexts = await this.processOCRFile(signedUrl.url);
      return processedPDFTexts;
    } catch (error) {
      throw new HttpException(
        error ?? 'Failed to process pdf',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async handleUploadForOCR(
    file: Express.Multer.File,
  ): Promise<UploadMistralFileModel> {
    try {
      const form = new FormData();
      const stream = Readable.from(file.buffer); // Convert buffer to stream

      form.append('purpose', 'ocr');
      form.append('file', stream, file.originalname);

      const { data } =
        await this.httpService.axiosRef.post<UploadMistralFileModel>(
          `${this.baseUrl}/files`,
          form,
          {
            headers: {
              Authorization: `Bearer ${EnvironmentVariables.config.mistralApiKey}`,
              ...form.getHeaders(), // Set proper headers for FormData
              Accept: 'application/json',
            },
          },
        );

      return data;
    } catch (error) {
      throw new HttpException(
        error?.response?.data || error?.message || 'Failed to OCR document',
        error?.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async retrieveSignedUrl(id: string) {
    try {
      return await this.client.files.getSignedUrl({ fileId: id });
    } catch (error) {
      throw new HttpException(
        error ?? 'Failed to retrieve signed url',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async processOCRFile(signedUrl: string) {
    try {
      const ocrResponse = await this.client.ocr.process({
        model: 'mistral-ocr-latest',
        document: {
          type: 'document_url',
          documentUrl: signedUrl,
        },
      });

      return ocrResponse.pages.map((p) => p.markdown);
    } catch (error) {
      throw new HttpException(
        error ?? 'Failed to carry out ocr processing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
