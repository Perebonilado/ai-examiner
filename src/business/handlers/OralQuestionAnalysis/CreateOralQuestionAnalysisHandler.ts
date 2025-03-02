import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateOralQuestionAnalysisRequest } from '../request/CreateOralQuestionAnalysisRequest';
import { CreateOralQuestionAnalysisResponse } from '../response/CreateOralQuestionAnalysisResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { OralQuestionAnalysisRepository } from 'src/business/repository/OralQuestionAnalysisRepository';
import { OralQuestionAnalysisModel } from 'src/infra/db/models/OralQuestionAnalysisModel';
import { CallAssistantMetaData } from 'src/integrations/vapi/models/InitiateCallModel';
import { CourseDocumentQueryService } from 'src/query/services/CourseDocumentQueryService';
import { QuestionQueryService } from 'src/query/services/QuestionQueryService';
import { UserQueryService } from 'src/query/services/UserQueryService';
import { ThreadTypeModel } from 'src/infra/web/models/ThreadTypeModel';
import { ExaminerService } from 'src/integrations/open-ai/services/ExaminerService';
import { UpdateCourseDocumentHandler } from '../CourseDocument/UpdateCourseDocumentHandler';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { extractJSONDataFromMessages } from 'src/utils';
import { getOralExaminationTranscriptAnalysisPrompt } from 'src/constants/QuestionGenerationPrompt';

@Injectable()
export class CreateOralQuestionAnalysisHandler extends AbstractRequestHandlerTemplate<
  CreateOralQuestionAnalysisRequest,
  CreateOralQuestionAnalysisResponse
> {
  constructor(
    @Inject(OralQuestionAnalysisRepository)
    private oralQuestionAnalysisRepository: OralQuestionAnalysisRepository,
    @Inject(CourseDocumentQueryService)
    private documentQueryService: CourseDocumentQueryService,
    @Inject(QuestionQueryService)
    private questionQueryService: QuestionQueryService,
    @Inject(UserQueryService) private userQueryService: UserQueryService,
    @Inject(ExaminerService) private examinerService: ExaminerService,
    @Inject(UpdateCourseDocumentHandler)
    private updateCourseDocumentHandler: UpdateCourseDocumentHandler,
  ) {
    super();
  }

  protected async handleRequest(
    request: CreateOralQuestionAnalysisRequest,
  ): Promise<CommandResponse<CreateOralQuestionAnalysisResponse>> {
    try {
      const { customerEmail, questionId } = request.data.message.assistant
        .metadata as unknown as CallAssistantMetaData;

      const user = await this.userQueryService.findOne(customerEmail);

      const question = await this.questionQueryService.findQuestionsById(
        questionId,
        user.id,
      );

      const analysis = await this.transcriptAnalysis(
        request.data.message.artifact.transcript,
        question.documentId,
        user.id,
      );

      await this.oralQuestionAnalysisRepository.create({
        callId: request.data.message.call.id,
        analysisData: analysis,
        questionId,
      } as OralQuestionAnalysisModel);

      // send email

      return {
        data: { questionId },
        message: 'success',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HandlerError(
        'Failed to handle oral question analysis request',
      ).InnerError(error);
    }
  }

  private async transcriptAnalysis(
    transcript: string,
    documentId: string,
    userId: string,
  ): Promise<string> {
    try {
      const document = await this.documentQueryService.findCourseDocumentById(
        documentId,
        userId,
      );
      const threadIdKey = 'oralQuestionThreadId' as ThreadTypeModel;
      let threadId = document[threadIdKey];

      if (!threadId?.length) {
        const vectorStore = await this.examinerService.createVectorStore(
          document.title,
        );

        const updatedVectorStoreId =
          await this.examinerService.attachFileToVectorStore(
            document.openAiFileId,
            vectorStore.id,
          );

        const thread = await this.examinerService.createThread();

        const updatedThread =
          await this.examinerService.attachVectorStoreToThread(
            thread.id,
            updatedVectorStoreId,
          );

        threadId = updatedThread.id;

        // update course document

        await this.updateCourseDocumentHandler.handle({
          userId: userId,
          data: {
            id: document.id,
            [threadIdKey]: updatedThread.id,
          },
        });
      }

      const existingThread = await this.examinerService.findThread(threadId);

      // check if vector store has expired, if so:
      // create new store, attach file and attach to thread

      const vectorStore = await this.examinerService.retrieveVectorStore(
        existingThread.tool_resources.file_search.vector_store_ids[0],
      );
      if (vectorStore.status === 'expired') {
        const newVectorStore = await this.examinerService.createVectorStore(
          document.title,
        );
        const updatedVectorStoreId =
          await this.examinerService.attachFileToVectorStore(
            document.openAiFileId,
            newVectorStore.id,
          );

        await this.examinerService.attachVectorStoreToThread(
          existingThread.id,
          updatedVectorStoreId,
        );
      }

      const MAX_RETRIES = 3; // Prevent infinite loops
      let retryCount = 0;
      let analysis: any[] = [];
      while (retryCount < MAX_RETRIES && !analysis.length) {
        await this.examinerService.createThreadMessage(
          existingThread.id,
          getOralExaminationTranscriptAnalysisPrompt(transcript),
        );

        const run = await this.examinerService.createRun(
          EnvironmentVariables.config.assistantIdPaidPlan,
          existingThread.id,
        );

        const messages = await this.examinerService.retrieveThreadMessages(
          existingThread.id,
          run.id,
        );

        const potentiallyAnalyzed = extractJSONDataFromMessages(messages);

        if (
          potentiallyAnalyzed instanceof Array &&
          potentiallyAnalyzed.length
        ) {
          analysis = potentiallyAnalyzed;
        }
      }

      if (analysis.length) {
        return JSON.stringify(analysis);
      }

      return JSON.stringify([]);
    } catch (error) {
      throw new HandlerError('Failed to handle result analysis').InnerError(
        error,
      );
    }
  }
}
