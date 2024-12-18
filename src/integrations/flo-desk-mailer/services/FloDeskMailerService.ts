import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { CreateFloDeskSubscriberPayload } from '../models/CreateFloDeskSubscriber';

@Injectable()
export class FloDeskMailerService {
  constructor(private httpService: HttpService) {}

  private baseUrl = `https://${EnvironmentVariables.config.floDeskBaseUrl}`;

  public async createSubscriber(payload: CreateFloDeskSubscriberPayload) {
    try {
      const url = `${this.baseUrl}/subscribers`;

      // Encode the API key using Base64
      const authToken = Buffer.from(
        `${EnvironmentVariables.config.floDeskApiKey}:`,
      ).toString('base64');

      await this.httpService.axiosRef.post(
        url,
        {
          email: payload.email,
          first_name: payload.firstName,
          last_name: payload.lastName,
          segment_ids: [...payload.segment_ids],
        },
        {
          headers: {
            'User-Agent': 'Your App Name (www.aiexaminer.app)', // Format of User-Agent header
            Authorization: `Basic ${authToken}`, // Use Basic Auth instead of Bearer
          },
        },
      );
    } catch (error) {
      console.log(error);
      throw new HttpException(
        'Failed to create subscriber on FloDesk',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
