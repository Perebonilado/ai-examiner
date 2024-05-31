import {
  Controller,
  Get,
  Delete,
  Inject,
  HttpStatus,
  HttpException,
  UseGuards,
  Query,
  Req,
  Res,
  Param,
  Post,
} from '@nestjs/common';
import { DeleteDocumentTopicHandler } from 'src/business/handlers/DocumentTopic/DeleteDocumentTopicHandler';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { Request, Response } from 'express';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { DocumentTopicQueryService } from 'src/query/services/DocumentTopicQueryService';
import { EnvironmentVariables } from 'src/EnvironmentVariables';
import { generateTopicPrompt } from 'src/constants';
import { extractJSONDataFromMessages } from 'src/utils';
import { ExaminerService } from 'src/integrations/open-ai/services/ExaminerService';

@Controller('document-topic')
export class DocumentTopicController {
  constructor(
    @Inject(DeleteDocumentTopicHandler)
    private deleteDocumentTopicHandler: DeleteDocumentTopicHandler,
    @Inject(DocumentTopicQueryService)
    private documentTopicQueryService: DocumentTopicQueryService,
    @Inject(ExaminerService) private examinerService: ExaminerService,
  ) {}

  @UseGuards(AuthGuard)
  @Get('')
  public async getAllDocumentTopics(
    @Query('documentId') documentId: string,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const topics =
        await this.documentTopicQueryService.findAllByDocumentTopicsByDocumentIdAndUserId(
          documentId,
          userToken.sub,
        );

      return topics.map((t) => {
        return {
          id: t.id,
          title: t.title,
        };
      });
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to find document topics',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Delete('/:id')
  public async deleteDocumentTopic(@Param('id') id: string) {
    try {
      return await this.deleteDocumentTopicHandler.handle({ payload: { id } });
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to delete document topics',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(AuthGuard)
  @Post('/generate/:fileId')
  public async generateDocumentTopics(
    @Param('fileId') fileId: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;

      const temporaryVectorStoreName = `${userToken.sub}_${new Date().getTime()}`;

      const temporaryVectorStore = await this.examinerService.createVectorStore(
        temporaryVectorStoreName,
      );

      const updatedVectorStoreId =
        await this.examinerService.attachFileToVectorStore(
          fileId,
          temporaryVectorStore.id,
        );

      const thread = await this.examinerService.createThread();

      const updatedThread =
        await this.examinerService.attachVectorStoreToThread(
          thread.id,
          updatedVectorStoreId,
        );

      await this.examinerService.createThreadMessage(
        updatedThread.id,
        generateTopicPrompt,
      );

      const run = await this.examinerService.createRun(
        EnvironmentVariables.config.assistantId,
        updatedThread.id,
      );

      const messages = await this.examinerService.retrieveThreadMessages(
        updatedThread.id,
        run.id,
      );

      const generatedTopics = extractJSONDataFromMessages(messages) as string[];

      //return response at this point
      response.status(201).json(Array.from(new Set(generatedTopics)));

      /* ===== Delete vectore store, and thread ==== */

      await this.examinerService.deleteVectorStore(updatedVectorStoreId);
      await this.examinerService.deleteThread(updatedThread.id);
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to generate topics for document',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
