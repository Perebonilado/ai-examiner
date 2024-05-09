import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { ExaminerModel } from '../models/ExaminerModel';
import { createReadStream, createWriteStream } from 'fs';
import { GenerateMCQPayloadModel, MCQModel } from '../models/MCQModel';
import { join } from 'path';
import { tmpdir } from 'os';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class AIExaminerService {
  private openAiClient: OpenAI;
  private examiner: OpenAI.Beta.Assistants.Assistant;
  private prompt = `
  Based off the file, generate 5 multiple choice questions and return only a json array format like this: [{ id: string, question: string, options: { value: string, id: string }[], correctAnswerId: string, explanation: string}]. This json structure should be the only thing you return, no other strings whatsoever. Ignore images in the file, and be as concise and fast as possible`;

  constructor(private readonly httpService: HttpService) {
    this.intializeOpenAiClient();
  }

  public async generateMultipleChoiceQuestions(
    payload: GenerateMCQPayloadModel,
  ) {
    try {
      await this.intializeExaminer(payload.examiner);
      await this.createVectorStore(payload.filePath);
      await this.createThread();
      await this.createRun();
      const messages = await this.retrieveThreadMessage();
      const questions = (messages.data[0].content[0] as any).text.value;
      return JSON.parse(
        questions.replace(/^```json\s*|\s*```$/g, ''),
      ) as unknown as MCQModel[];
    } catch (error) {
      throw new HttpException(
        'Falied to generate multiple choice questions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private intializeOpenAiClient() {
    try {
      this.openAiClient = new OpenAI({
        apiKey: EnvironmentVariables.config.openAiApiKey,
      });
    } catch (error) {
      throw new HttpException(
        'Falied to initialize open AI client',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async intializeExaminer(examiner: ExaminerModel) {
    try {
      this.examiner = await this.openAiClient.beta.assistants.create({
        name: examiner.name,
        instructions: examiner.instructions,
        model: 'gpt-3.5-turbo',
        tools: [{ type: 'file_search' }],
      });
    } catch (error) {
      throw new HttpException(
        'Falied to initialize AI examiner',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async createVectorStore(url: string) {
    try {
      const { data: arrayBuffer } = await this.httpService.axiosRef.get(url, {
        responseType: 'arraybuffer',
      });
      const splitUrl = url.split('.');
      const extension = splitUrl[splitUrl.length - 1];
      const tempFilePath = join(
        tmpdir(),
        `${new Date().getTime()}.${extension}`,
      );
      await new Promise((resolve, reject) => {
        const writeStream = createWriteStream(tempFilePath);
        writeStream.write(arrayBuffer);
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);
        writeStream.end();
      });

      const fileStream = createReadStream(tempFilePath, {
        autoClose: true,
      });

      const vectorStore = await this.openAiClient.beta.vectorStores.create({
        name: 'Educational Material',
      });
      await this.openAiClient.beta.vectorStores.fileBatches.uploadAndPoll(
        vectorStore.id,
        { files: [fileStream] },
      );
      await this.openAiClient.beta.assistants.update(this.examiner.id, {
        tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } },
      });
    } catch (error) {
      throw new HttpException(
        'Falied to create vector store',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async createThread(): Promise<OpenAI.Beta.Threads.Thread> {
    try {
      const thread = await this.openAiClient.beta.threads.create({
        messages: [
          {
            role: 'user',
            content: this.prompt,
          },
        ],
      });
      return thread;
    } catch (error) {
      throw new HttpException(
        'Falied to create thread',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async createRun(): Promise<
    readonly [OpenAI.Beta.Threads.Runs.Run, OpenAI.Beta.Threads.Thread]
  > {
    try {
      const thread = await this.createThread();
      const run = await this.openAiClient.beta.threads.runs.createAndPoll(
        thread.id,
        {
          assistant_id: this.examiner.id,
        },
      );
      return [run, thread] as const;
    } catch (error) {
      throw new HttpException(
        'Falied to create run',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async retrieveThreadMessage(): Promise<OpenAI.Beta.Threads.Messages.MessagesPage> {
    try {
      const [run, thread] = await this.createRun();
      const messages = await this.openAiClient.beta.threads.messages.list(
        thread.id,
        {
          run_id: run.id,
        },
      );
      return messages;
    } catch (error) {
      throw new HttpException(
        'Falied to create retrieve messages',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
