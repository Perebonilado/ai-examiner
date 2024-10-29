import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { createReadStream, existsSync } from 'fs';
import { extname, join } from 'path';
import { tmpdir } from 'os';
import { unlink } from 'fs/promises';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import {
  convertOldPptToText,
  extractTextFromBuffer,
  extractTextFromPDF,
  generateUUID,
  getFileNameWithoutExtension,
  writeFileToStream,
} from 'src/utils';

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
        tools: [{ type: 'file_search' }],
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

  public async uploadFile(
    file: Express.Multer.File,
    pdfPageRange: {
      start?: number;
      end?: number;
    },
  ) {
    try {
      let tempFilePath: string | null
      const isPDF = file.mimetype === 'application/pdf';
      const mimeTypesToConvertToText = [
        'application/pdf',
        'application/vnd.ms-powerpoint', //older ppt format
      ];
      const fileExtension = mimeTypesToConvertToText.includes(file.mimetype)
        ? '.txt'
        : extname(file.originalname);
      const tempFileName = `${generateUUID()}${fileExtension}`;
      tempFilePath = join(tmpdir(), tempFileName);

      let fileContent: string | Buffer;

      if (mimeTypesToConvertToText.includes(file.mimetype)) {
        if (!isPDF) {
          if (file.mimetype === 'application/vnd.ms-powerpoint') {
            fileContent = await convertOldPptToText(file.buffer);
          } else {
            fileContent = await extractTextFromBuffer({
              mimeType: file.mimetype,
              buffer: file.buffer,
            });
          }
        } else {
          fileContent = await extractTextFromPDF(file, {
            firstPage: pdfPageRange?.start,
            lastPage: pdfPageRange?.end,
          });
        }
      } else {
        fileContent = file.buffer;
      }

      if (isPDF && !fileContent.length) {
        throw new HttpException(
          'Scanned PDFs or PDFs containing only images are not allowed / Select a valid page range',
          HttpStatus.BAD_REQUEST,
        );
      }

      const encoding = isPDF ? 'utf-8' : 'latin1';

      await writeFileToStream(tempFilePath, fileContent, encoding);

      const fileStream = createReadStream(tempFilePath, { autoClose: true });

      const uploadedFile = await this.openAiClient.files.create({
        file: fileStream,
        purpose: 'assistants',
      });

      // Add a small delay before attempting to delete the file
      await new Promise(resolve => setTimeout(resolve, 100));

      if (tempFilePath && existsSync(tempFilePath)) {
        try {
          await unlink(tempFilePath);
        } catch (unlinkError) {
          console.warn(`Failed to delete temporary file: ${tempFilePath}`, unlinkError);
          // Continue execution even if file deletion fails
        }
      }

      return uploadedFile;
    } catch (error) {
      console.log(error)
      throw new HttpException(
        error || 'Failed to upload file',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  public async attachFileToVectorStore(
    fileId: string,
    vectorStoreId: string,
  ): Promise<string> {
    const maxRetries = 3; // Maximum number of retries
    let attempts = 0; // Counter for attempts

    while (attempts < maxRetries) {
      try {
        const createdVectorStore =
          await this.openAiClient.beta.vectorStores.files.createAndPoll(
            vectorStoreId,
            {
              file_id: fileId,
            },
          );

        // Check if the status is not 'failed'
        if (createdVectorStore.status !== 'failed') {
          return createdVectorStore.vector_store_id; // Success, return the vector store ID
        }

        // Increment the attempt counter if the status is 'failed'
        attempts++;
      } catch (error) {
        // Catch any errors thrown during the process
        attempts++;
        if (attempts >= maxRetries) {
          throw new HttpException(
            'Failed to attach file to vector store after 3 attempts',
            HttpStatus.BAD_GATEWAY,
          );
        }
      }
    }

    // If all attempts fail
    throw new HttpException(
      'Failed to attach file to vector store after 3 attempts',
      HttpStatus.BAD_GATEWAY,
    );
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
