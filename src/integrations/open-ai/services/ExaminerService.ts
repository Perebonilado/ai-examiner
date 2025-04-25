import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { createReadStream, existsSync } from 'fs';
import { extname, join } from 'path';
import { tmpdir } from 'os';
import { unlink } from 'fs/promises';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import {
  convertOldPptToText,
  extractPagesTextsFromPDF,
  extractTextFromBuffer,
  extractTextFromPDF,
  generateUUID,
  writeFileToStream,
} from 'src/utils';
import { ILovePdfService } from 'src/integrations/i-love-pdf/services/ILovePdfService';
import { PineconeChunkService } from 'src/integrations/pinecone/services/PineconeChunksService';
import { EmbeddingModel } from '../models/EmbeddingModel';
import { MistralOcrService } from 'src/integrations/mistral-ai/services/MistralOcrService';
import { handWritingOCRPrompt } from 'src/constants/V2Prompts';

@Injectable()
export class ExaminerService {
  constructor(
    @Inject(ILovePdfService) private IlovePdfService: ILovePdfService,
    @Inject(MistralOcrService) private mistralOcrService: MistralOcrService,
  ) {
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
      return await this.openAiClient.vectorStores.create({
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
      return await this.openAiClient.vectorStores.del(storeId);
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
      return await this.openAiClient.vectorStores.files.del(
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
      let tempFilePath: string | null;
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
            const fileArrayBuffer =
              await this.IlovePdfService.processFileBasedOnTool(
                file,
                'officepdf',
              );
            fileContent = await extractTextFromPDF(fileArrayBuffer);
          } else {
            fileContent = await extractTextFromBuffer({
              mimeType: file.mimetype,
              buffer: file.buffer,
            });
          }
        } else {
          // const fileArrayBuffer =
          //   await this.IlovePdfService.processFileBasedOnTool(file, 'pdfocr');
          fileContent = (await this.mistralOcrService.processPdf(file)).join(
            '\n',
          );
        }
      } else {
        fileContent = file.buffer;
      }

      if (isPDF && !fileContent.length) {
        throw new HttpException(
          'PDF content is unreadable',
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
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (tempFilePath && existsSync(tempFilePath)) {
        try {
          await unlink(tempFilePath);
        } catch (unlinkError) {
          console.warn(
            `Failed to delete temporary file: ${tempFilePath}`,
            unlinkError,
          );
          // Continue execution even if file deletion fails
        }
      }

      return uploadedFile;
    } catch (error) {
      throw new HttpException(
        error || 'Failed to upload file',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  public async handWrittenPDFOCR(file: Buffer): Promise<string> {
    const tempFileName = `${generateUUID()}.pdf`;
    const tempFilePath = join(tmpdir(), tempFileName);

    let lastError: any;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await writeFileToStream(tempFilePath, file);

        const fileStream = createReadStream(tempFilePath, {
          autoClose: true,
        });

        const uploaded = await this.openAiClient.files.create({
          file: fileStream,
          purpose: 'user_data',
        });

        const { output_text: text } = await this.openAiClient.responses.create({
          model: 'gpt-4o-mini',
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_file',
                  file_id: uploaded.id,
                },
                {
                  type: 'input_text',
                  text: handWritingOCRPrompt,
                },
              ],
            },
          ],
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        return text.toLowerCase() === 'no text' ? '' : text;
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt} failed: ${error.message}`);
      } finally {
        if (existsSync(tempFilePath)) {
          try {
            await unlink(tempFilePath);
          } catch (unlinkError) {
            console.warn(
              `Failed to delete temporary file: ${tempFilePath}`,
              unlinkError,
            );
          }
        }
      }
    }

    throw new HttpException(
      lastError?.message ?? 'Failed to OCR file after multiple attempts',
      lastError?.status ?? HttpStatus.BAD_REQUEST,
    );
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
          await this.openAiClient.vectorStores.files.createAndPoll(
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
      return await this.openAiClient.vectorStores.retrieve(storeId);
    } catch (error) {
      throw new HttpException(
        'Falied to retrieve vector store',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  public async retrieveRun(threadId: string, runId: string) {
    try {
      return await this.openAiClient.beta.threads.runs.retrieve(
        threadId,
        runId,
      );
    } catch (error) {
      throw new HttpException('Failed to retrieve run', HttpStatus.BAD_GATEWAY);
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

  public async generateEmbeddings(chunks: string[]): Promise<EmbeddingModel> {
    const response = await this.openAiClient.embeddings.create({
      model: 'text-embedding-ada-002',
      input: chunks,
    });

    return response.data.map((embedding) => embedding.embedding);
  }
}
