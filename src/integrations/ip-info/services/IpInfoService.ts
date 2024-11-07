import { HttpService } from '@nestjs/axios';
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { IpInfoModel } from '../models/IpInfoModel';
import { IpInfoDto } from '../dto/IpInfoDto';

@Injectable()
export class IpInfoService {
  constructor(private httpService: HttpService) {}

  private baseUrl = 'https://ipinfo.io';

  public async getIpDetails(ipAddress: string): Promise<IpInfoModel> {
    try {
      const { data } = await this.httpService.axiosRef.get<
        any,
        AxiosResponse<IpInfoDto>
      >(`${this.baseUrl}/${ipAddress}`, {
        params: {
          access_key: EnvironmentVariables.config.ipInfoToken,
        },
      });

      return data;
    } catch (error) {
      throw new HttpException(
        'Failed to get ip details',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
