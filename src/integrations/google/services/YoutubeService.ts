import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  YoutubeSearchModel,
  YouTubeSearchResponse,
} from '../models/YoutubeSearchModel';
import { HttpService } from '@nestjs/axios';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { AxiosResponse } from 'axios';

@Injectable()
export class YoutubeService {
  constructor(private httpService: HttpService) {}

  private baseUrl = 'https://www.googleapis.com';

  public async youtubeVideoSearch(query: YoutubeSearchModel) {
    try {
      const { data } = await this.httpService.axiosRef.get<
        any,
        AxiosResponse<YouTubeSearchResponse>
      >(`${this.baseUrl}/youtube/v3/search`, {
        params: {
          q: query.query,
          maxResults: query.maxResults,
          key: EnvironmentVariables.config.youtubeApiKey,
          part: 'snippet',
          imgSize: 'HUGE'
        },
      });

      return data.items;
    } catch (error) {
        console.log(error)
      throw new HttpException(
        error.message ?? 'Failed to perform youtube search',
        error.status ?? HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
