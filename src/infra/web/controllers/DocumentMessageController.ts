import {
  Controller,
  Inject,
  Post,
  Body,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
  Get,
  Query,
  ParseIntPipe,
  Res,
  Param,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CreateDocumentMessageDto } from 'src/dto/CreateDocumentMessageDto';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { VerifiedTokenModel } from 'src/infra/auth/models/VerifiedTokenModel';
import { DocumentMessageQueryService } from 'src/query/services/DocumentMessageQueryService';
import { DocumentChatService } from '../services/document-chat/DocumentChatService';
import {
  chatRequestProblem,
  parseChatRequest,
  sseEvent,
} from '../services/document-chat/chatPrompt';

/** Keeps proxies from closing the stream while the model thinks. */
const PING_MS = 15_000;
const MAX_PAGE_SIZE = 50;
const FAILED_MESSAGE =
  'Sorry, something went wrong while answering. Please try again.';

@Controller('document-message')
export class DocumentMessageController {
  private readonly logger = new Logger(DocumentMessageController.name);

  constructor(
    @Inject(DocumentChatService)
    private documentChatService: DocumentChatService,
    @Inject(DocumentMessageQueryService)
    private documentMessageQueryService: DocumentMessageQueryService,
  ) {}

  /**
   * Streams the reply as server-sent events:
   *   meta     { mode, pages }   which pages the reply is reading (before it starts)
   *   thinking {}                the model is thinking before it writes
   *   delta    { text }          the next piece of the reply
   *   done     { status, messageId?, text? }   status: done | truncated | refused
   *                              (text: the notice to show instead, when refused)
   *   error    { message }       the reply failed; the question is saved, so retry with retry: true
   * Errors before the stream starts (bad request, unknown document) are plain JSON responses.
   */
  @UseGuards(AuthGuard)
  @Post('stream')
  public async streamDocumentMessage(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: CreateDocumentMessageDto,
  ) {
    const userId = (req['user'] as VerifiedTokenModel).sub;
    const request = parseChatRequest(body);
    if (!request) {
      res
        .status(HttpStatus.BAD_REQUEST)
        .json({ message: chatRequestProblem(body) });
      return;
    }

    let document;
    try {
      document = await this.documentChatService.findDocument(
        body.courseDocumentId,
        userId,
      );
    } catch (error) {
      res
        .status(error?.status ?? HttpStatus.BAD_REQUEST)
        .json({ message: error?.message ?? 'Document not found' });
      return;
    }

    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const abort = new AbortController();
    // The app pressed Stop, navigated away or lost its connection: stop generating.
    res.on('close', () => {
      if (!res.writableEnded) abort.abort();
    });
    const send = (event: string, data: unknown) => {
      if (!res.writableEnded && !res.destroyed)
        res.write(sseEvent(event, data));
    };
    const ping = setInterval(() => {
      if (!res.writableEnded && !res.destroyed) res.write(': ping\n\n');
    }, PING_MS);

    try {
      const outcome = await this.documentChatService.reply({
        document,
        userId,
        request,
        retry: body.retry === true,
        signal: abort.signal,
        sink: {
          meta: (info) => send('meta', info),
          thinking: () => send('thinking', {}),
          text: (text) => send('delta', { text }),
        },
      });
      if (outcome.status !== 'stopped') {
        send('done', {
          status: outcome.status,
          messageId: outcome.messageId,
          ...(outcome.status === 'refused' ? { text: outcome.text } : {}),
        });
      }
    } catch (error) {
      this.logger.error(
        `Chat reply failed for document ${document.id}: ${error?.message ?? error}`,
      );
      send('error', { message: FAILED_MESSAGE });
    } finally {
      clearInterval(ping);
      if (!res.writableEnded) res.end();
    }
  }

  /** The same reply as one JSON response (apps that don't stream yet). */
  @UseGuards(AuthGuard)
  @Post('')
  public async createDocumentMessage(
    @Req() req: Request,
    @Body() body: CreateDocumentMessageDto,
  ) {
    const userId = (req['user'] as VerifiedTokenModel).sub;
    const request = parseChatRequest(body);
    if (!request) {
      throw new HttpException(chatRequestProblem(body), HttpStatus.BAD_REQUEST);
    }
    const document = await this.documentChatService.findDocument(
      body.courseDocumentId,
      userId,
    );
    try {
      const outcome = await this.documentChatService.reply({
        document,
        userId,
        request,
        retry: body.retry === true,
        sink: { meta: () => {}, thinking: () => {}, text: () => {} },
      });
      return {
        data: { systemResponse: outcome.text },
        message: 'Messages successfully created',
        status: HttpStatus.CREATED,
      };
    } catch (error) {
      this.logger.error(
        `Chat reply failed for document ${document.id}: ${error?.message ?? error}`,
      );
      throw new HttpException(FAILED_MESSAGE, HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(AuthGuard)
  @Get('/:courseDocumentId')
  public async getUserDocumentMessages(
    @Req() req: Request,
    @Param('courseDocumentId') courseDocumentId: string,
    @Query('limit', ParseIntPipe) limit: number = 5,
    @Query('lastMessageCreatedOn') lastMessageCreatedOn: Date,
  ) {
    const userId = (req['user'] as VerifiedTokenModel).sub;
    // Only the document's owner can read its chat.
    await this.documentChatService.findDocument(courseDocumentId, userId);
    try {
      return await this.documentMessageQueryService.findDocumentMessagesByCourseDocumentId(
        {
          courseDocumentId,
          limit: Math.min(Math.max(limit, 1), MAX_PAGE_SIZE),
          lastMessageCreatedOn,
        },
      );
    } catch (error) {
      throw new HttpException(
        error?.response ?? 'Failed to find document messages',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
