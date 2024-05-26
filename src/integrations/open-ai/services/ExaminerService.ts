import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { createReadStream, createWriteStream } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { unlink } from 'fs/promises';
import { EnvironmentVariables } from 'src/EnvironmentVariables';

@Injectable()
export class ExaminerService {
  constructor() {
    this.intializeOpenAiClient();
  }

  private openAiClient: OpenAI;

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

  public async createAssistant(): Promise<OpenAI.Beta.Assistants.Assistant> {
    try {
      return await this.openAiClient.beta.assistants.create({
        name: 'Examiner',
        instructions:
          'You are an examiner for students that will read through materials and generate questions to help students study better',
        model: 'gpt-4o',
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

  public async createThreadMessage(threadId: string, message: string) {
    try {
      return await this.openAiClient.beta.threads.messages.create(threadId, {
        role: 'user',
        content: message,
      });
    } catch (error) {
      throw new HttpException(
        'Falied to create thread message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async retrieveThreadMessages(threadId: string) {
    try {
      return await this.openAiClient.beta.threads.messages.list(threadId);
    } catch (error) {
      throw new HttpException(
        'Falied to retrieve thread messages',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async createRun(assistantId: string, threadId: string) {
    try {
      await this.openAiClient.beta.threads.runs.createAndPoll(threadId, {
        assistant_id: assistantId,
      });
    } catch (error) {
      throw new HttpException(
        'Falied to create run',
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
      // const tempFilePath = join(tmpdir(), file.originalname);
      // await new Promise((resolve, reject) => {
      //   const writeStream = createWriteStream(tempFilePath);
      //   writeStream.write(file.buffer);
      //   writeStream.on('error', reject);
      //   writeStream.on('finish', resolve);
      //   writeStream.end();
      // });

      // const fileStream = createReadStream(tempFilePath, {
      //   autoClose: true,
      // });

      const uploadedFile = await this.openAiClient.files.create({
        file: file as unknown as File,
        purpose: 'assistants',
      });

      // await unlink(tempFilePath);

      return uploadedFile;
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
