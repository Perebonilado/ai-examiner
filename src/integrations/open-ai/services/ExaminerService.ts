import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { createReadStream, createWriteStream } from 'fs';
import { GenerateMCQPayloadModel, MCQModel } from '../models/MCQModel';
import { join } from 'path';
import { tmpdir } from 'os';
import { HttpService } from '@nestjs/axios';
import { unlink } from 'fs/promises';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { ExaminerModel } from '../models/ExaminerModel';

@Injectable()
export class ExaminerService {
  constructor(private readonly httpService: HttpService) {
    this.intializeOpenAiClient();
  }

  private openAiClient: OpenAI;
  //   private examiner: OpenAI.Beta.Assistants.Assistant;
  private prompt = `
  Based off the file, generate 5 multiple choice questions and return only a json array format like this: [{ id: string, question: string, options: { value: string, id: string }[], correctAnswerId: string, explanation: string}]. This json structure should be the only thing you return, no other strings whatsoever. Ignore images in the file, and be as concise and fast as possible`;

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

  public async createAssistant(
    examiner: ExaminerModel,
  ): Promise<OpenAI.Beta.Assistants.Assistant> {
    try {
      return await this.openAiClient.beta.assistants.create({
        name: examiner.name as unknown as string,
        instructions: examiner.instructions,
        model: 'gpt-3.5-turbo',
        tools: [{ type: 'file_search' }],
      });
    } catch (error) {
      throw new HttpException(
        'Falied to initialize assistant',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async createThread() {
    try {
      const thread = await this.openAiClient.beta.threads.create();
      return thread;
    } catch (error) {
      throw new HttpException(
        'Falied to create thread',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async attachVectorStoreToThread(
    threadId: string,
    vectorStoreId: string,
  ) {
    try {
      return await this.openAiClient.beta.threads.update(threadId, {
        tool_resources: {
          file_search: { vector_store_ids: [vectorStoreId] },
        },
      });
    } catch (error) {
      throw new HttpException(
        'Falied to attach vector store to thread',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async createVectorStore(name: string) {
    try {
      return await this.openAiClient.beta.vectorStores.create({
        name,
      });
    } catch (error) {
      throw new HttpException(
        'Falied to create vector store',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async uploadFile(file: Express.Multer.File) {
    try {
      const tempFilePath = join(tmpdir(), file.originalname);
      await new Promise((resolve, reject) => {
        const writeStream = createWriteStream(tempFilePath);
        writeStream.write(file.buffer);
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);
        writeStream.end();
      });

      const fileStream = createReadStream(tempFilePath, {
        autoClose: true,
      });

      return await this.openAiClient.files.create({
        file: fileStream,
        purpose: 'assistants',
      });
    } catch (error) {
      throw new HttpException(
        'Falied to upload file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async attachFileToVectorStore(
    fileId: string,
    vectorStoreId: string,
  ): Promise<OpenAI.Beta.VectorStores.VectorStore> {
    try {
      await this.openAiClient.beta.vectorStores.files.create(vectorStoreId, {
        file_id: fileId,
      });

      return await this.retrieveVectorStore(vectorStoreId);
    } catch (error) {
      throw new HttpException(
        'Falied to attach file to vector store',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async retrieveVectorStore(storeId: string) {
    try {
      return await this.openAiClient.beta.vectorStores.retrieve(storeId);
    } catch (error) {
      throw new HttpException(
        'Falied to retrieve vector store',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async findThread(
    threadId: string,
  ): Promise<OpenAI.Beta.Threads.Thread> {
    try {
      return await this.openAiClient.beta.threads.retrieve(threadId);
    } catch (error) {
      throw new HttpException(
        'Falied to find thread',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
