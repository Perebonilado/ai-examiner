import { HttpStatus, Inject, Injectable } from '@nestjs/common';
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
import { PreferredLanguageQueryService } from 'src/query/services/PreferredLanguageQueryService';

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
    @Inject(PreferredLanguageQueryService)
    private preferredLanguageQueryService: PreferredLanguageQueryService,
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

      if (request.payload?.documentSummaryData) {
        const { documentId, fileId, message, threadId } =
          request.payload.documentSummaryData;
        await this.documentMessageRepository.create({
          message: message,
          sender: 'system',
          openAiFileId: fileId,
          openAiThreadId: threadId,
          userId: userId,
          courseDocumentId: documentId,
        } as DocumentMessageModel);

        return {
          message: 'Summary created',
          data: { systemResponse: message },
          status: HttpStatus.CREATED
        };
      }

      const assistantId = EnvironmentVariables.config.assistantIdPaidPlan;

      const courseDocument =
        await this.courseDocumentQueryService.findCourseDocumentById(
          courseDocumentId,
          userId,
        );

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

        const preferredLanguage =
          await this.preferredLanguageQueryService.findByUserId(userId);

        await this.examinerService.createThreadMessage(
          updatedThread.id,
          generateMessagePrompt({
            message: userMessage,
            responseFormat: request.payload.responseFormat,
            prefix: request.payload.notSureQuestion
              ? messagePromptPrefixGenerator(request.payload.notSureQuestion)
              : '',
            language: preferredLanguage
              ? preferredLanguage.language
              : 'English',
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

        const preferredLanguage =
          await this.preferredLanguageQueryService.findByUserId(userId);

        await this.examinerService.createThreadMessage(
          existingThread.id,
          generateMessagePrompt({
            message: userMessage,
            responseFormat: request.payload.responseFormat,
            prefix: request.payload.notSureQuestion
              ? messagePromptPrefixGenerator(request.payload.notSureQuestion)
              : '',
            language: preferredLanguage
              ? preferredLanguage.language
              : 'English',
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
}
