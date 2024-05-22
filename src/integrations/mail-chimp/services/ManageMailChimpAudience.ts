import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { HttpService } from '@nestjs/axios';
import {
  AddMemberToListPayloadModel,
  AddMemberToListResponseModel,
} from '../models/AddMemberToList';

@Injectable()
export class ManageMailChimpAudience {
  constructor(private httpService: HttpService) {}

  private baseUrl = `https://${EnvironmentVariables.config.mailChimpServerPrefix}.api.mailchimp.com/3.0`;
  private audienceId = EnvironmentVariables.config.mailChimpAudienceId;

  public async addMemberToList(
    payload: AddMemberToListPayloadModel,
  ): Promise<AddMemberToListResponseModel> {
    try {
      const url = `${this.baseUrl}/lists/${this.audienceId}/members`;

      await this.httpService.axiosRef.post(
        url,
        {
          email_address: payload.email,
          status: 'subscribed',
          merge_fields: {
            FNAME: payload.firstName,
            LNAME: payload.lastName
          }
        },
        {
          headers: {
            Authorization: `Basic ${Buffer.from('anystring:' + EnvironmentVariables.config.mailChimpApiKey).toString('base64')}`,
          },
        },
      );

      return {
        message: 'User successfully added to mailing list',
        data: {
          email: payload.email,
        },
      };
    } catch (error) {
      throw new HttpException(
        'Failed to save member to mailchimp list',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async confirmIsMemberSubscribed(email: string) {
    try {
      const url = `${this.baseUrl}/search-members`;
      const member = await this.httpService.axiosRef.get(url, {
        params: {
          query: email,
          list_id: this.audienceId,
        },
        headers: {
          Authorization: `Basic ${Buffer.from('anystring:' + EnvironmentVariables.config.mailChimpApiKey).toString('base64')}`,
        },
      });

      return true;
    } catch (error) {
      throw new HttpException(
        'Failed to check member subscription status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
