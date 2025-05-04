import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  YoutubeSearchModelRapid ,
  YoutubeSearchPayload,
} from '../models/YoutubeSearch';
import { AxiosResponse } from 'axios';
import { EnvironmentVariables } from 'src/EnvironmentVariables';

@Injectable()
export class YoutubeSearchService {
  constructor(private httpService: HttpService) {}

  private baseUrl = 'https://youtube-search-api.p.rapidapi.com';

  public async search(payload: YoutubeSearchPayload) {
    try {
      const { data } = await this.httpService.axiosRef.post<
        any,
        AxiosResponse<YoutubeSearchModelRapid >
      >(
        `${this.baseUrl}/search`,
        {
          search_query: payload.searchQuery,
        },
        {
          headers: {
            'x-rapidapi-key': EnvironmentVariables.config.rapidApiKey,
            'x-rapidapi-host': 'youtube-search-api.p.rapidapi.com',
            'Content-Type': 'application/json',
          },
        },
      );

      return data;
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Failed to search youtube',
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }
}
