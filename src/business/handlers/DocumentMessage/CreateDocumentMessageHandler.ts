import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { CreateDocumentMessageRequest } from '../request/CreateDocumentMessageRequest';
import { CreateDocumentMessageResponse } from '../response/CreateDocumentMessageResponse';
import { DocumentMessageRepository } from 'src/business/repository/DocumentMessageRepository';
import { DocumentMessageQueryService } from 'src/query/services/DocumentMessageQueryService';
import { ExaminerService } from 'src/integrations/open-ai/services/ExaminerService';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { CourseDocumentQueryService } from 'src/query/services/CourseDocumentQueryService';
import { DocumentMessageModel } from 'src/infra/db/models/DocumentMessageModel';
import {
  generateMessagePrompt,
  messagePromptPrefixGenerator,
} from 'src/constants';
import { UpdateCourseDocumentHandler } from '../CourseDocument/UpdateCourseDocumentHandler';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import {
  generateDocumentMessagePromptV2,
  getRefinedImagePrompt,
} from 'src/constants/V2Prompts';
import { PineconeChunkService } from 'src/integrations/pinecone/services/PineconeChunksService';
import { DocumentSummaryQueryService } from 'src/query/services/DocumentSummaryQueryService';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

@Injectable()
export class CreateDocumentMessageHandler extends AbstractRequestHandlerTemplate<
  CreateDocumentMessageRequest,
  CreateDocumentMessageResponse
> {
  constructor(
    @Inject(DocumentMessageRepository)
    private documentMessageRepository: DocumentMessageRepository,
    @Inject(ExaminerService) private examinerService: ExaminerService,
    @Inject(CourseDocumentQueryService)
    private courseDocumentQueryService: CourseDocumentQueryService,
    @Inject(UpdateCourseDocumentHandler)
    private updateCourseDocumentHandler: UpdateCourseDocumentHandler,
    @Inject(PineconeChunkService)
    private pineconeChunkService: PineconeChunkService,
    @Inject(DocumentMessageQueryService)
    private documentMessageQueryService: DocumentMessageQueryService,
    @Inject(DocumentSummaryQueryService)
    private documentSummaryQueryService: DocumentSummaryQueryService,
  ) {
    super();
  }

  public async handleRequest(
    request: CreateDocumentMessageRequest,
  ): Promise<CommandResponse<CreateDocumentMessageResponse>> {
    try {
      const {
        courseDocumentId,
        message: userMessage,
        userId,
      } = request.payload;

      const assistantId = EnvironmentVariables.config.assistantIdPaidPlan;

      const courseDocument =
        await this.courseDocumentQueryService.findCourseDocumentById(
          courseDocumentId,
          userId,
        );

      const useRag =
        courseDocument.openAiFileId === 'not yet set' ||
        request.payload?.highlightToPrompt;

      /* might have to switch to this completely once the conversational flow for it is better. Use it when the file has not been uploaded
      to open ai
      **/

      const relevantChunks =
        await this.pineconeChunkService.semanticChunkSearch(
          userMessage,
          courseDocument.id,
          20,
        );

      if (request.payload?.imageDescriptionData?.imageUrl) {
        const systemResponse = await this.getImageDescriptionMessage({
          documentId: courseDocument.id,
          image: request.payload?.imageDescriptionData?.imageUrl,
          initialQuery: userMessage,
          relatedContent: relevantChunks.join('\n'),
        });

        const savedUserMessage = await this.documentMessageRepository.create({
          message: 'Tell me more about this image',
          sender: 'user',
          openAiFileId: courseDocument.openAiFileId,
          openAiThreadId: ' ',
          image: request.payload?.imageDescriptionData?.imageUrl,
          userId: userId,
          courseDocumentId: courseDocument.id,
        } as DocumentMessageModel);

        if (savedUserMessage) {
          setTimeout(async () => {
            const systemMessageWithContext = `
              ${systemResponse}
  
              **source text start**
              ${relevantChunks.join('\n')}
              **source text end**
            `;
            await this.documentMessageRepository.create({
              message: systemMessageWithContext,
              sender: 'system',
              openAiFileId: courseDocument.openAiFileId,
              openAiThreadId: ' ',
              userId: userId,
              courseDocumentId: courseDocument.id,
            } as DocumentMessageModel);
          }, 1000);
        }

        return {
          data: { systemResponse },
          message: 'Messages successfully created',
          status: HttpStatus.CREATED,
        };
      }

      if (useRag) {
        const previousMessages =
          await this.documentMessageQueryService.findDocumentMessagesByCourseDocumentId(
            {
              courseDocumentId: courseDocument.id,
              limit: 20,
              includeSourceTextInSystemResponse: true,
            },
          );
        const mappedPrevMessages = previousMessages.data.map((message) => {
          return {
            role: message.sender,
            content: message.message,
          };
        });
        const { text: systemResponse } = await this.getSystemResponseUsingRag(
          messagePromptPrefixGenerator({
            highlightToPrompt: request.payload.highlightToPrompt,
          }) || userMessage,
          relevantChunks.join('\n'),
          mappedPrevMessages,
        );

        const savedUserMessage = await this.documentMessageRepository.create({
          message: userMessage,
          sender: 'user',
          openAiFileId: courseDocument.openAiFileId,
          openAiThreadId: ' ',
          userId: userId,
          courseDocumentId: courseDocument.id,
        } as DocumentMessageModel);

        if (savedUserMessage) {
          setTimeout(async () => {
            const systemMessageWithContext = `
              ${systemResponse}

              **source text start**
              ${relevantChunks.join('\n')}
              **source text end**
            `;
            await this.documentMessageRepository.create({
              message: systemMessageWithContext,
              sender: 'system',
              openAiFileId: courseDocument.openAiFileId,
              openAiThreadId: ' ',
              userId: userId,
              courseDocumentId: courseDocument.id,
            } as DocumentMessageModel);
          }, 1000);
        }

        return {
          data: { systemResponse },
          message: 'Messages successfully created',
          status: HttpStatus.CREATED,
        };
      }

      //check if there is an existing thread

      const existingThreadId = courseDocument?.documentChatThreadId;

      if (!existingThreadId?.length) {
        // create thread/vector store
        const vectorStore = await this.examinerService.createVectorStore(
          `user_messages_vector_store_${courseDocument.title}`,
        );

        const updatedVectorStoreId =
          await this.examinerService.attachFileToVectorStore(
            courseDocument.openAiFileId,
            vectorStore.id,
          );

        const thread = await this.examinerService.createThread();

        const updatedThread =
          await this.examinerService.attachVectorStoreToThread(
            thread.id,
            updatedVectorStoreId,
          );

        // update course document with thread id

        await this.updateCourseDocumentHandler.handle({
          userId: request.payload.userId,
          data: {
            id: courseDocument.id,
            documentChatThreadId: updatedThread.id,
          },
        });

        await this.examinerService.createThreadMessage(
          updatedThread.id,
          generateMessagePrompt({
            message: userMessage,
            responseFormat: request.payload.responseFormat,
            prefix: request.payload.notSureQuestion
              ? messagePromptPrefixGenerator({
                  question: request.payload.notSureQuestion,
                  highlightToPrompt: request.payload.highlightToPrompt,
                })
              : '',
            language: 'English',
          }),
        );

        const run = await this.examinerService.createRun(
          assistantId,
          updatedThread.id,
        );

        const messages = await this.examinerService.retrieveThreadMessages(
          updatedThread.id,
          run.id,
        );

        const systemMessage = (messages.data[0].content[0] as any).text.value;

        const savedUserMessage = await this.documentMessageRepository.create({
          message: userMessage,
          sender: 'user',
          openAiFileId: courseDocument.openAiFileId,
          openAiThreadId: updatedThread.id,
          userId: userId,
          courseDocumentId: courseDocument.id,
        } as DocumentMessageModel);

        if (savedUserMessage) {
          setTimeout(async () => {
            await this.documentMessageRepository.create({
              message: systemMessage,
              sender: 'system',
              openAiFileId: courseDocument.openAiFileId,
              openAiThreadId: updatedThread.id,
              userId: userId,
              courseDocumentId: courseDocument.id,
            } as DocumentMessageModel);
          }, 1000);
        }

        return {
          data: { systemResponse: systemMessage },
          message: 'Messages successfully created',
          status: HttpStatus.CREATED,
        };
      } else {
        const existingThread =
          await this.examinerService.findThread(existingThreadId);
        const vectorStore = await this.examinerService.retrieveVectorStore(
          existingThread.tool_resources.file_search.vector_store_ids[0],
        );

        // check if vector store has expired, if so:
        // create new store, attach file and attach to thread

        if (vectorStore.status === 'expired') {
          const newVectorStore = await this.examinerService.createVectorStore(
            `user_messages_vector_store_${courseDocument.title}`,
          );
          const updatedVectorStoreId =
            await this.examinerService.attachFileToVectorStore(
              courseDocument.openAiFileId,
              newVectorStore.id,
            );

          await this.examinerService.attachVectorStoreToThread(
            existingThread.id,
            updatedVectorStoreId,
          );
        }

        await this.examinerService.createThreadMessage(
          existingThread.id,
          generateMessagePrompt({
            message: userMessage,
            responseFormat: request.payload.responseFormat,
            prefix: request.payload.notSureQuestion
              ? messagePromptPrefixGenerator({
                  question: request.payload.notSureQuestion,
                  highlightToPrompt: request.payload.highlightToPrompt,
                })
              : '',
            language: 'English',
          }),
        );

        const run = await this.examinerService.createRun(
          assistantId,
          existingThread.id,
        );

        const messages = await this.examinerService.retrieveThreadMessages(
          existingThread.id,
          run.id,
        );

        const systemMessage = (messages.data[0].content[0] as any).text.value;

        const savedUserMessage = await this.documentMessageRepository.create({
          message: userMessage,
          sender: 'user',
          openAiFileId: courseDocument.openAiFileId,
          openAiThreadId: existingThread.id,
          userId: userId,
          courseDocumentId: courseDocument.id,
        } as DocumentMessageModel);

        if (savedUserMessage) {
          setTimeout(async () => {
            await this.documentMessageRepository.create({
              message: systemMessage,
              sender: 'system',
              openAiFileId: courseDocument.openAiFileId,
              openAiThreadId: existingThread.id,
              userId: userId,
              courseDocumentId: courseDocument.id,
            } as DocumentMessageModel);
          }, 1000);
        }

        return {
          data: {
            systemResponse: systemMessage,
          },
          message: 'Messages successfully created',
          status: HttpStatus.CREATED,
        };
      }
    } catch (error) {
      throw new HandlerError(
        'Failed to handle Document Message creation',
      ).InnerError(error);
    }
  }

  private async getImageDescriptionMessage({
    documentId,
    initialQuery,
    image,
    relatedContent,
  }: {
    documentId: string;
    initialQuery: string;
    image: string;
    relatedContent: string;
  }) {
    try {
      const summary =
        await this.documentSummaryQueryService.findByDocumentId(documentId);

      const openaiClient = createOpenAI({
        compatibility: 'strict',
        apiKey: EnvironmentVariables.config.openAiApiKey,
      });

      const imageDescription = await generateText({
        model: openaiClient('gpt-4o-mini'),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: `Describe the image in deep detail` },
              {
                type: 'image',
                image: image,
                providerOptions: {
                  openai: { imageDetail: 'high' },
                },
              },
            ],
          },
        ],
      });

      const refined = await generateText({
        model: openaiClient('gpt-4o-mini'),
        messages: [
          {
            role: 'user',
            content: getRefinedImagePrompt({
              imageDesc: imageDescription.text,
              initialQuery,
              summary: summary.summary,
              relatedContent,
            }),
          },
        ],
      });

      return refined.text;
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Failed to get system response: image description',
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async getSystemResponseUsingRag(
    message: string,
    sourceText: string,
    messages: { role: 'system' | 'user'; content: string }[],
  ) {
    try {
      // const openai = createOpenAI({
      //   compatibility: 'strict',
      //   apiKey: EnvironmentVariables.config.openAiApiKey,
      // });
      const google = createGoogleGenerativeAI({
        apiKey: EnvironmentVariables.config.geminiApiKey,
      });

      const { text } = await generateText({
        model: google('gemini-1.5-flash'),
        messages: [
          ...messages,
          {
            role: 'user',
            content: generateDocumentMessagePromptV2(message, sourceText),
          },
        ],
      });

      const prevResponseId = ''
      // const prevResponseId = providerMetadata?.openai
      //   ?.responseId as unknown as string;

      return { text, prevResponseId };
    } catch (error) {
      throw new HttpException(
        error.message ?? 'Failed to get system response',
        error.status ?? HttpStatus.BAD_REQUEST,
      );
    }
  }
}
