import { HttpService } from '@nestjs/axios';
import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import {
  GoogleImageSearchModel,
  GoogleImageSearchResponseModel,
} from '../models/GoogleSearchModel';

@Injectable()
export class GoogleSearchService {
  constructor(private httpService: HttpService) {}

  private baseUrl = 'https://customsearch.googleapis.com/customsearch/v1';

  public async imageSearch(query: string): Promise<GoogleImageSearchModel[]> {
    try {
      const { data } = await this.httpService.axiosRef.get<
        any,
        AxiosResponse<GoogleImageSearchResponseModel>
      >(`${this.baseUrl}`, {
        params: {
          key: EnvironmentVariables.config.googleApiKey,
          cx: EnvironmentVariables.config.googleSearchEngineId,
          searchType: 'image',
          q: query,
        },
      });

      return data.items.map((item) => {
        return { imageUrl: item.link, title: item.title };
      });
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Google drive: upload error',
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }
}
