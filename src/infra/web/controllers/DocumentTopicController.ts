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
import {
  generateTopicPrompt,
  inactiveSubscriptionStatuses,
} from 'src/constants';
import { extractJSONDataFromMessages, generateUUID } from 'src/utils';
import { ExaminerService } from 'src/integrations/open-ai/services/ExaminerService';
import { CreateDocumentTopicHandler } from 'src/business/handlers/DocumentTopic/CreateDocumentTopicHandler';
import { CourseDocumentQueryService } from 'src/query/services/CourseDocumentQueryService';
import { SubscriptionQueryService } from 'src/query/services/SubscriptionQueryService';
import { PaystackSubscriptionService } from 'src/integrations/paystack/services/PaystackSubscriptionService';
import { DocumentTopicModel } from 'src/infra/db/models/DocumentTopicModel';

@Controller('document-topic')
export class DocumentTopicController {
  constructor(
    @Inject(DeleteDocumentTopicHandler)
    private deleteDocumentTopicHandler: DeleteDocumentTopicHandler,
    @Inject(DocumentTopicQueryService)
    private documentTopicQueryService: DocumentTopicQueryService,
    @Inject(ExaminerService) private examinerService: ExaminerService,
    @Inject(CreateDocumentTopicHandler)
    private createDocumentTopicHandler: CreateDocumentTopicHandler,
    @Inject(CourseDocumentQueryService)
    private courseDocumentQueryService: CourseDocumentQueryService,
    @Inject(SubscriptionQueryService)
    private subscriptionQueryService: SubscriptionQueryService,
    @Inject(PaystackSubscriptionService)
    private paystackSubscriptionService: PaystackSubscriptionService,
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

      const uniqueTopicsMap = new Map<string, { id: number; title: string }>();

      for (const topic of topics) {
        if (!uniqueTopicsMap.has(topic.title.toLowerCase())) {
          uniqueTopicsMap.set(topic.title.toLowerCase(), {
            id: topic.id,
            title: topic.title,
          });
        }
      }

      const uniqueTopics = Array.from(uniqueTopicsMap.values());

      return uniqueTopics;
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to find document topics',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // newer api for topics
  @UseGuards(AuthGuard)
  @Get('/:id')
  public async getAllDocumentTopicsV2(
    @Param('id') documentId: string,
    @Req() request: Request,
  ) {
    try {
      const userToken = request['user'] as VerifiedTokenModel;
      const topics =
        await this.documentTopicQueryService.findAllDocumentTopicsWithReadingProgress(
          documentId,
        );

        const uniqueTopicsMap = new Map<string, typeof topics[number]>();

      topics.forEach((topic)=>{
        if (!uniqueTopicsMap.has(`${topic.startPage}-${topic.endPage}-${topic.title}`)) {
          uniqueTopicsMap.set(`${topic.startPage}-${topic.endPage}-${topic.title}`, topic)
        }
      })

      return Array.from(uniqueTopicsMap.values());
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
}
