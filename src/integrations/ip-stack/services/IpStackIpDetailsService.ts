import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { IpDetailsModel } from '../models/IpDetailsModel';
import { AxiosResponse } from 'axios';
import { IpDetailsDto } from '../dto/IpDetailsDto';
import { EnvironmentVariables } from 'src/EnvironmentVariables';

@Injectable()
export class IpStackIpDetailsService {
  constructor(private httpService: HttpService) {}

  private baseUrl = 'https://api.ipstack.com';

  public async getIpDetails(ipAddress: string): Promise<IpDetailsModel> {
    try {
      const { data } = await this.httpService.axiosRef.get<
        any,
        AxiosResponse<IpDetailsDto>
      >(`${this.baseUrl}/${ipAddress}`, {
        params: {
          access_key: EnvironmentVariables.config.ipStackApiKey,
        },
      });

      return {
        city: data.city,
        continentCode: data.continent_code,
        continentName: data.continent_name,
        countryCode: data.country_code,
        countryName: data.country_name,
        hostname: data.hostname,
        ip: data.ip,
        regionCode: data.region_code,
        regionName: data.region_name,
        currencyCode: data.currency.code
      };
    } catch (error) {
      throw new HttpException(
        'Failed to get ip details',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
