import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { VapiClient } from '@vapi-ai/server-sdk';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { InitiateCallModel } from '../models/InitiateCallModel';
import {
  CreateVapiAssistantModel,
  CreateVapiAssistantPayloadModel,
} from '../models/CreateVapiAssistantModel';

@Injectable()
export class VapiCallingService {
  constructor() {
    this.client = new VapiClient({
      token: EnvironmentVariables.config.vapiPrivateKey,
    });
  }

  private client: VapiClient;

  public async createAssistantForClientCall(
    assistantPayload: CreateVapiAssistantPayloadModel,
  ): Promise<CreateVapiAssistantModel> {
    try {
      const { messageContent, userName, metadata } = assistantPayload;
      const assistant = await this.client.assistants.create({
        model: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: messageContent }],
          tools: [{ type: 'endCall' }],
          temperature: 0.8,
        },
        firstMessage: `Hello ${userName}, how are you doing today?`,
        name: userName,
        metadata: metadata as unknown as Record<string, unknown>,
        maxDurationSeconds: 120,
      });

      return {
        id: assistant.id,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to handle client call initiation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async deleteVapiAssistant(assistantId: string) {
    try {
      return await this.client.assistants.delete(assistantId);
    } catch (error) {
      throw new Error('Failed to delete assistant');
    }
  }

  public async initiateCall(initateCallPayload: InitiateCallModel) {
    try {
      const { messageContent, userName, userPhoneNumber, metadata } =
        initateCallPayload;

      const assistant = await this.client.assistants.create({
        model: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: messageContent }],
          tools: [{ type: 'endCall' }],
          temperature: 0.8,
        },
        firstMessage: `Hello ${userName}, how are you doing today?`,
        name: userName,
        metadata: metadata as unknown as Record<string, unknown>,
        maxDurationSeconds: 120,
      });

      return await this.client.calls.create({
        assistantId: assistant.id,
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
        error ?? 'Failed to initiate call',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
