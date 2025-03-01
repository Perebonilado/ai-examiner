import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { VapiClient } from '@vapi-ai/server-sdk';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { InitiateCallModel } from '../models/InitiateCallModel';

@Injectable()
export class VapiCallingService {
  constructor() {
    this.client = new VapiClient({
      token: EnvironmentVariables.config.vapiPrivateKey,
    });
  }

  private client: VapiClient;

  public async initiateCall(initateCallPayload: InitiateCallModel) {
    try {
      const { messageContent, userName, userPhoneNumber, metadata } =
        initateCallPayload;

      return await this.client.calls.create({
        assistant: {
          firstMessage: '{{ name }}',
          model: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: '' },
              { role: 'assistant', content: messageContent },
            ],
            tools: [{ type: 'endCall' }],
          },
          name: userName,
          endCallMessage:
            'Thank you for your time. We would notify you via email once your response has been graded. Have a great day!',
          metadata: metadata as unknown as Record<string, unknown>,
        },
        phoneNumber: {
          twilioAccountSid: EnvironmentVariables.config.twilioAccountSID,
          twilioAuthToken: EnvironmentVariables.config.twilioAuthToken,
          twilioPhoneNumber: EnvironmentVariables.config.twilioPhoneNumber,
        },
        customer: {
          number: userPhoneNumber,
        },
      });
    } catch (error) {
      throw new HttpException(
        'Failed to initiate call',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
