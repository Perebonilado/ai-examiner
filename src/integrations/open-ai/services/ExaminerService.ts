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
        HttpStatus.BAD_GATEWAY,
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
        HttpStatus.BAD_GATEWAY,
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
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  public async deleteThread(threadId: string) {
    try {
      const response = await this.openAiClient.beta.threads.del(threadId);
      return response;
    } catch (error) {
      throw new HttpException(
        'Falied to delete thread',
        HttpStatus.BAD_GATEWAY,
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
        HttpStatus.BAD_GATEWAY,
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
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  public async retrieveThreadMessages(threadId: string, runId: string) {
    try {
      return await this.openAiClient.beta.threads.messages.list(threadId, {
        run_id: runId,
      });
    } catch (error) {
      throw new HttpException(
        'Falied to retrieve thread messages',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  public async createRun(assistantId: string, threadId: string) {
    try {
      return await this.openAiClient.beta.threads.runs.createAndPoll(threadId, {
        assistant_id: assistantId,
      });
    } catch (error) {
      throw new HttpException('Falied to create run', HttpStatus.BAD_GATEWAY);
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
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  public async deleteVectorStore(storeId: string) {
    try {
      return await this.openAiClient.beta.vectorStores.del(storeId);
    } catch (error) {
      throw new HttpException(
        'Falied to delete vector store',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  public async deleteVectorStoreFile({
    vectorStoreId,
    fileId,
  }: {
    vectorStoreId: string;
    fileId: string;
  }) {
    try {
      return await this.openAiClient.beta.vectorStores.files.del(
        vectorStoreId,
        fileId,
      );
    } catch (error) {
      throw new HttpException(
        'Falied to delete vector store file',
        HttpStatus.BAD_GATEWAY,
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

      const uploadedFile = await this.openAiClient.files.create({
        file: fileStream,
        purpose: 'assistants',
      });

      await unlink(tempFilePath);

      return uploadedFile;
    } catch (error) {
      throw new HttpException('Falied to upload file', HttpStatus.BAD_GATEWAY);
    }
  }

  public async attachFileToVectorStore(
    fileId: string,
    vectorStoreId: string,
  ): Promise<string> {
    try {
      const createdVectorStore =
        await this.openAiClient.beta.vectorStores.files.createAndPoll(
          vectorStoreId,
          {
            file_id: fileId,
          },
        );

      return createdVectorStore.vector_store_id;
    } catch (error) {
      throw new HttpException(
        'Falied to attach file to vector store',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  public async retrieveVectorStore(storeId: string) {
    try {
      return await this.openAiClient.beta.vectorStores.retrieve(storeId);
    } catch (error) {
      throw new HttpException(
        'Falied to retrieve vector store',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  public async findThread(
    threadId: string,
  ): Promise<OpenAI.Beta.Threads.Thread> {
    try {
      return await this.openAiClient.beta.threads.retrieve(threadId);
    } catch (error) {
      throw new HttpException('Falied to find thread', HttpStatus.BAD_GATEWAY);
    }
  }
}
