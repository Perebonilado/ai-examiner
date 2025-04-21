import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { VapiClient } from '@vapi-ai/server-sdk';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { InitiateCallModel } from '../models/InitiateCallModel';
import {
  CreateVapiAssistantModel,
  CreateVapiAssistantPayloadModel,
} from '../models/CreateVapiAssistantModel';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { translateEnglishToOtherLanguagePrompt } from 'src/constants/QuestionGenerationPromptV2';

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
      const { messageContent, userName, metadata, maxDurationMs, language } =
        assistantPayload;

      let messageContentToUse = messageContent;
      let firstMessageToUse = `Hello ${userName}, how are you doing today?`;

      if (language.toLowerCase() !== 'english') {
        const [translatedFirstMessage, translatedMessageContent] =
          await this.translateContent(
            [firstMessageToUse, messageContentToUse],
            language,
          );

        firstMessageToUse = translatedFirstMessage;
        messageContentToUse = translatedMessageContent;
      }

      const assistant = await this.client.assistants.create({
        model: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: messageContentToUse }],
          tools: [{ type: 'endCall' }],
          temperature: 0.8,
        },
        firstMessage: firstMessageToUse,
        name: userName,
        metadata: metadata as unknown as Record<string, unknown>,
        maxDurationSeconds: maxDurationMs,
      });

      return {
        id: assistant.id,
      };
    } catch (error) {
      throw new HttpException(
        error ?? 'Failed to handle client call initiation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async translateContent(content: string[], language: string) {
    try {
      const openai = createOpenAI({
        compatibility: 'strict',
        apiKey: EnvironmentVariables.config.openAiApiKey,
      });

      const promises = content.map((c) => {
        return generateText({
          model: openai.responses('gpt-4o-mini'),
          maxRetries: 3,
          prompt: translateEnglishToOtherLanguagePrompt(c, language),
        });
      });

      const translated = await Promise.all(promises);

      return translated.map((tr) => tr.text);
    } catch (error) {
      throw new HttpException(
        'Failed to translate content',
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

  public async getCallInformation(callId: string) {
    try {
      return await this.client.calls.get(callId);
    } catch (error) {
      throw new Error('Failed to find call information');
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
