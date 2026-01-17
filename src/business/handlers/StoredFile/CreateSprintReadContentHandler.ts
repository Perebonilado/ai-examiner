import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import AbstractRequestHandlerTemplate from '../AbstractRequestHandlerTemplate';
import { CreateSprintReadContentRequest } from '../request/CreateSprintReadContentRequest';
import { CreateSpringReadContentResponse } from '../response/CreateSprintReadContentResponse';
import { CommandResponse } from '../response/CommandResponse';
import { HandlerError } from 'src/error-handlers/business/HandlerError';
import { DocumentTopicQueryService } from 'src/query/services/DocumentTopicQueryService';
import { PineconeChunkService } from 'src/integrations/pinecone/services/PineconeChunksService';
import { GEMINI_CONN } from 'src/integrations/vercel-ai/services/GeminiConn';
import { OPENAI_CONN } from 'src/integrations/vercel-ai/services/OpenAIConn';
import { AI } from 'src/integrations/vercel-ai/services/AI';
import { batchItems, PDFContent } from 'src/utils';
import { getKeypointPrompt, getSprintReadContentPrompt } from 'src/constants';
import { DocumentSummaryQueryService } from 'src/query/services/DocumentSummaryQueryService';
import { SimplifiedPDFArraySchema } from 'src/schemas/SimplifiedPDFSchema';
import { UpdateStoredFileHandler } from './UpdateStoredFileHandler';
import { StoredFileQueryService } from 'src/query/services/StoredFileQueryService';

export interface GroupedContent {
  content: string;
  totalPagesJoined: number;
}

@Injectable()
export class CreateSprintReadContentHandler extends AbstractRequestHandlerTemplate<
  CreateSprintReadContentRequest,
  CreateSpringReadContentResponse
> {
  constructor(
    @Inject(DocumentTopicQueryService)
    private readonly documentTopicQueryService: DocumentTopicQueryService,
    @Inject(PineconeChunkService)
    private readonly pineconeService: PineconeChunkService,
    @Inject(GEMINI_CONN) private readonly geminiConn: AI,
    @Inject(OPENAI_CONN) private readonly openAIConn: AI,
    @Inject(DocumentSummaryQueryService)
    private readonly documentSummaryQueryService: DocumentSummaryQueryService,
    @Inject(UpdateStoredFileHandler)
    private readonly updateStoredFileHandler: UpdateStoredFileHandler,
    @Inject(StoredFileQueryService)
    private readonly storedFileQueryService: StoredFileQueryService,
  ) {
    super();
  }

  protected async handleRequest(
    request: CreateSprintReadContentRequest,
  ): Promise<CommandResponse<CreateSpringReadContentResponse>> {
    try {
      const documentSummary =
        await this.documentSummaryQueryService.findByDocumentId(
          request.documentId,
        );
      const groupedContent = await this.getGroupedContent(request.documentId);
      const groupedKeyPoints = await this.getKeyPointsToKnowBasedOnContent(
        groupedContent.map((c) => c.content),
        documentSummary.summary,
      );
      const compressedContentBasedOnKeyPoints: PDFContent[][] =
        await this.getCompressedContentBasedOnKeyPoints(
          groupedContent,
          groupedKeyPoints,
          documentSummary.summary,
        );

      const existingStoredFile =
        await this.storedFileQueryService.findByDocumentId(request.documentId);
      await this.updateStoredFileHandler.handle({
        id: existingStoredFile.id,
        sprintReadContent: compressedContentBasedOnKeyPoints,
      });
      return {
        data: {
          data: compressedContentBasedOnKeyPoints,
        },
        message: 'Sprint read content created',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      console.log(error)
      throw new HandlerError(
        `Failed to create sprint content for document with id: ${request.documentId}`,
      );
    }
  }

  private async getCompressedContentBasedOnKeyPoints(
    groupedContent: GroupedContent[],
    groupedKeyPoints: string[],
    summary: string,
  ) {
    try {
      const compressedPages: PDFContent[][] = [];
      let currIndex = 0;
      for (const content of groupedContent) {
        const previousContent = currIndex === 0 ? '' : compressedPages.flat().map((p)=>p.text).join('\n')
        const compressed = await this.geminiConn.generateObject({
          schemaName: 'Compressed and Simplified',
          prompt: getSprintReadContentPrompt(
            content,
            groupedKeyPoints[currIndex],
            summary,
            currIndex === 0,
            previousContent
          ),
          schema: SimplifiedPDFArraySchema,
        });
        compressedPages.push(
          compressed.object.simplifiedContent as PDFContent[],
        );
        currIndex++;
      }
      return compressedPages;
    } catch (error) {
      throw new HandlerError(`Failed to compresss document content`);
    }
  }

  private async getKeyPointsToKnowBasedOnContent(
    content: string[],
    summary: string,
  ) {
    const batchedContent = batchItems(content, 10);
    const keyPointsPerContentItem: string[] = [];
    for (const batch of batchedContent) {
      const keypoints = await Promise.all(
        batch.map(async (contentItem) => {
          const keypoint = await this.geminiConn.generateText({
            prompt: getKeypointPrompt(summary, contentItem),
          });
          return keypoint;
        }),
      );
      keyPointsPerContentItem.push(...keypoints);
    }

    return keyPointsPerContentItem;
  }

  private async getGroupedPageNumbers(documentId: string): Promise<number[][]> {
    const topics =
      await this.documentTopicQueryService.findAllByDocumentTopicsByDocumentIdAndUserId(
        documentId,
      );
    const hasPaginatedTopics = topics.every(
      (topic) => topic.startPage && topic.endPage,
    );

    if (!hasPaginatedTopics) {
      throw new HandlerError(
        'Please reupload this document to use sprint read',
      );
    }

    const groupedTopics = batchItems(topics, 10);
    const groupedPageNumbers = groupedTopics.map((topics) => {
      const pageNumbers: number[] = [];
      topics.forEach((topic) => {
        pageNumbers.push(
          ...this.generatePagesBasedOnRange(topic.startPage, topic.endPage),
        );
      });
      return pageNumbers;
    });

    const sortedGroups = groupedPageNumbers.map((group) => {
      const uniquePages = Array.from(new Set(group));
      return uniquePages.sort((a, b) => {
        return a - b;
      });
    });

    const uniqueGroups: number[][] = [];

    sortedGroups.forEach((group) => {
      if (!uniqueGroups.some((g) => g[0] === group[0])) {
        uniqueGroups.push(group);
      }
    });

    return uniqueGroups;
  }

  private async getGroupedContent(
    documentId: string,
  ): Promise<GroupedContent[]> {
    const groupedPageNumbers: number[][] =
      await this.getGroupedPageNumbers(documentId);
    const groupedPagesContentJoined: {
      content: string;
      totalPagesJoined: number;
    }[] = [];

    for (const groupedPages of groupedPageNumbers) {
      const content = await Promise.all(
        groupedPages.map(async (page) => {
          const index = page - 1;
          const content = await this.pineconeService.chunkByIndexSearch(
            index,
            documentId,
          );
          return content;
        }),
      );
      groupedPagesContentJoined.push({
        content: content.join('\n \n'),
        totalPagesJoined: content.length,
      });
    }

    return groupedPagesContentJoined;
  }

  private generatePagesBasedOnRange(start: number, end: number): number[] {
    const pages: number[] = [];
    for (let i: number = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  }
}
