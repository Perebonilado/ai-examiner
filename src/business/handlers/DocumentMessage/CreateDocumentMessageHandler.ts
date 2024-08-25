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

@Injectable()
export class CreateDocumentMessageHandler extends AbstractRequestHandlerTemplate<
  CreateDocumentMessageRequest,
  CreateDocumentMessageResponse
> {
  constructor(
    @Inject(DocumentMessageRepository)
    private documentMessageRepository: DocumentMessageRepository,
    @Inject(DocumentMessageQueryService)
    private documentMessageQueryService: DocumentMessageQueryService,
    @Inject(ExaminerService) private examinerService: ExaminerService,
    @Inject(CourseDocumentQueryService)
    private courseDocumentQueryService: CourseDocumentQueryService,
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

      //check if there is an existing message (indicating a thread exists)
      const existingMessage =
        await this.documentMessageQueryService.findDocumentMessagesByCourseDocumentId(
          { courseDocumentId, limit: 1 },
        );

      if (!existingMessage[0]) {
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

        await this.examinerService.createThreadMessage(
          updatedThread.id,
          userMessage,
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

        // save user message, then system message
        await this.documentMessageRepository.create({
          message: userMessage,
          sender: 'user',
          openAiFileId: courseDocument.openAiFileId,
          openAiThreadId: updatedThread.id,
          userId: userId,
          courseDocumentId: courseDocument.id,
        } as DocumentMessageModel);

        await this.documentMessageRepository.create({
          message: systemMessage,
          sender: 'system',
          openAiFileId: courseDocument.openAiFileId,
          openAiThreadId: updatedThread.id,
          userId: userId,
          courseDocumentId: courseDocument.id,
        } as DocumentMessageModel);

        return {
          data: { data: null },
          message: 'Messages successfully created',
          status: HttpStatus.CREATED,
        };
      } else {
        const threadId = existingMessage[0].openAiThreadId;
        const existingThread = await this.examinerService.findThread(threadId);
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
          userMessage,
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

        // save user message, then system message
        await this.documentMessageRepository.create({
          message: userMessage,
          sender: 'user',
          openAiFileId: courseDocument.openAiFileId,
          openAiThreadId: existingThread.id,
          userId: userId,
          courseDocumentId: courseDocument.id,
        } as DocumentMessageModel);

        await this.documentMessageRepository.create({
          message: systemMessage,
          sender: 'system',
          openAiFileId: courseDocument.openAiFileId,
          openAiThreadId: existingThread.id,
          userId: userId,
          courseDocumentId: courseDocument.id,
        } as DocumentMessageModel);

        return {
          data: { data: null },
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
