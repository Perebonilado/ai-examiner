import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { MistralClient } from './MistralClient';
import fs from 'fs';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class Mistral extends MistralClient {
  constructor() {
    super();
  }

  private baseUrl = 'https://api.mistral.ai/v1';

  public async handleOCR(file: Express.Multer.File) {
    // try {
    //   const uploadedFile = await this.client.files.upload({
    //     file
    //   })
    // } catch (error) {
    //   throw new HttpException(
    //     error ?? 'Failed to ocr document',
    //     HttpStatus.INTERNAL_SERVER_ERROR,
    //   );
    // }
  }

  public async uploadFileForOCR(file: Express.Multer.File){
    try {
      
    } catch (error) {
      // throw new HttpException(error ?? 'Failed to upload file for ocr')
    }
  }
}
