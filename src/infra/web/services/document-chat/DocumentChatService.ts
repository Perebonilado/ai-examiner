import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { DocumentMessageRepository } from 'src/business/repository/DocumentMessageRepository';
import { DocumentMessageModel } from 'src/infra/db/models/DocumentMessageModel';
import { CourseDocumentModel } from 'src/infra/db/models/CourseDocumentModel';
import { PineconeChunkService } from 'src/integrations/pinecone/services/PineconeChunksService';
import {
  CLAUDE_CONN,
  ClaudeConn,
} from 'src/integrations/vercel-ai/services/ClaudeConn';
import { CourseDocumentQueryService } from 'src/query/services/CourseDocumentQueryService';
import { DocumentMessageQueryService } from 'src/query/services/DocumentMessageQueryService';
import { DocumentSummaryQueryService } from 'src/query/services/DocumentSummaryQueryService';
import { SimplifiedPageQueryService } from 'src/query/services/SimplifiedPageQueryService';
import {
  ChatRequest,
  HISTORY_MESSAGES,
  PageText,
  Passage,
  buildSearchQuery,
  buildSystemPrompt,
  buildUserTurn,
  citedPageNumbers,
  effortFor,
  historyToTurns,
  pagesAreReliable,
  passagesFromHits,
  shouldSendWholeDocument,
} from './chatPrompt';

/** Where a reply's progress goes (the SSE stream, or nowhere for the old JSON endpoint). */
export interface ChatSink {
  /** Before the reply starts: which pages it is reading. */
  meta(info: { mode: 'document' | 'passages'; pages: number[] }): void;
  /** The model is thinking before it writes. */
  thinking(): void;
  text(delta: string): void;
}

export type ChatOutcomeStatus = 'done' | 'truncated' | 'stopped' | 'refused';

export interface ChatOutcome {
  status: ChatOutcomeStatus;
  /** The reply as saved (for a refusal: the notice shown instead). */
  text: string;
  messageId?: string;
}

const PASSAGES = 8;
const PAGE_CACHE_MS = 10 * 60 * 1000;
/** A document without page text yet may get it soon (Easy Read saves it on first open). */
const EMPTY_PAGE_CACHE_MS = 60 * 1000;
/** Page text kept in memory across documents (~16 MB as JS strings). */
const PAGE_CACHE_MAX_CHARS = 8_000_000;
/** created_on has one-second precision; a reply saved in the same second could sort first. */
const MIN_GAP_AFTER_QUESTION_MS = 1100;
const IMAGE_MESSAGE = 'Tell me more about this image';
export const REFUSAL_NOTICE =
  "Sorry, I can't help with that one. Try asking about it in a different way.";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const imageBlock = (
  url?: string,
): Anthropic.Beta.BetaImageBlockParam | null => {
  if (!url) return null;
  const dataUrl = url.match(
    /^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/i,
  );
  if (dataUrl) {
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: dataUrl[1].toLowerCase() as
          | 'image/jpeg'
          | 'image/png'
          | 'image/gif'
          | 'image/webp',
        data: dataUrl[2],
      },
    };
  }
  if (/^https?:\/\//i.test(url)) {
    return { type: 'image', source: { type: 'url', url } };
  }
  return null;
};

/**
 * Document chat: finds what the reply needs (recent messages, the document or the passages that
 * match), saves the question, streams Claude's reply into a sink and saves it.
 */
@Injectable()
export class DocumentChatService {
  private readonly logger = new Logger(DocumentChatService.name);
  /** Overridable in tests. */
  protected minGapAfterQuestionMs = MIN_GAP_AFTER_QUESTION_MS;
  private readonly pageCache = new Map<
    string,
    { at: number; pages: PageText[]; chars: number }
  >();
  private pageCacheChars = 0;

  constructor(
    @Inject(CourseDocumentQueryService)
    private courseDocumentQueryService: CourseDocumentQueryService,
    @Inject(DocumentMessageQueryService)
    private documentMessageQueryService: DocumentMessageQueryService,
    @Inject(DocumentSummaryQueryService)
    private documentSummaryQueryService: DocumentSummaryQueryService,
    @Inject(SimplifiedPageQueryService)
    private simplifiedPageQueryService: SimplifiedPageQueryService,
    @Inject(DocumentMessageRepository)
    private documentMessageRepository: DocumentMessageRepository,
    @Inject(PineconeChunkService)
    private pineconeChunkService: PineconeChunkService,
    @Inject(CLAUDE_CONN) private readonly claude: ClaudeConn,
  ) {}

  /** The user's document, or 404 (also for someone else's document). */
  public async findDocument(documentId: string, userId: string) {
    const document = documentId
      ? await this.courseDocumentQueryService.findCourseDocumentById(
          documentId,
          userId,
        )
      : null;
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }

  public async reply({
    document,
    userId,
    request,
    retry = false,
    signal,
    sink,
  }: {
    document: CourseDocumentModel;
    userId: string;
    request: ChatRequest;
    /** The question was already saved by the attempt that failed. */
    retry?: boolean;
    signal?: AbortSignal;
    sink: ChatSink;
  }): Promise<ChatOutcome> {
    const startedAt = Date.now();
    const shownMessage = request.imageUrl
      ? IMAGE_MESSAGE
      : request.message.trim();

    const [recent, summary, pages] = await Promise.all([
      this.documentMessageQueryService.findRecentMessages(
        document.id,
        HISTORY_MESSAGES + 1,
      ),
      this.documentSummaryQueryService.findByDocumentId(document.id),
      this.getPages(document.id),
    ]);

    // On a retry the question is already the newest message: reuse it rather than save it twice.
    const newest = recent[recent.length - 1];
    const alreadySaved =
      retry &&
      newest?.sender === 'user' &&
      newest.message.trim() === shownMessage;
    const history = (alreadySaved ? recent.slice(0, -1) : recent).slice(
      -HISTORY_MESSAGES,
    );

    const wholeDocument = shouldSendWholeDocument(pages);
    const citePages = pagesAreReliable(pages);
    let passages: Passage[] | null = null;
    if (!wholeDocument) {
      const hits = await this.pineconeChunkService.searchPassages(
        buildSearchQuery(request, history),
        document.id,
        PASSAGES,
      );
      passages = passagesFromHits(hits, pages);
    }
    const contextReadyAt = Date.now();

    const system = buildSystemPrompt({
      title: document.title,
      summary: summary?.summary,
      pages,
      wholeDocument,
      citePages,
    });
    const userTurn = buildUserTurn({ request, passages });
    const image = imageBlock(request.imageUrl);

    const turns = historyToTurns(history);
    // The conversation has to open with the student.
    while (turns.length && turns[0].role !== 'user') turns.shift();
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      ...turns,
      {
        role: 'user',
        content: image ? [image, { type: 'text', text: userTurn }] : userTurn,
      },
    ];

    if (!alreadySaved) {
      await this.saveMessage(
        document,
        userId,
        'user',
        shownMessage,
        request.imageUrl,
      );
    }
    const questionSavedAt = Date.now();

    sink.meta({
      mode: wholeDocument ? 'document' : 'passages',
      pages: passages ? citedPageNumbers(passages) : [],
    });

    let firstTextAt: number | null = null;
    const result = await this.claude.streamText({
      system,
      cacheSystem: true,
      messages,
      effort: effortFor(request),
      signal,
      onThinking: () => sink.thinking(),
      onText: (delta) => {
        firstTextAt ??= Date.now();
        sink.text(delta);
      },
    });

    let outcome: ChatOutcome;
    if (result.aborted) {
      outcome = { status: 'stopped', text: result.text };
    } else if (result.stopReason === 'refusal') {
      outcome = { status: 'refused', text: REFUSAL_NOTICE };
    } else if (result.stopReason === 'max_tokens') {
      outcome = { status: 'truncated', text: result.text };
    } else {
      outcome = { status: 'done', text: result.text };
    }

    if (outcome.text.trim()) {
      const wait = this.minGapAfterQuestionMs - (Date.now() - questionSavedAt);
      if (wait > 0) await sleep(wait);
      const saved = await this.saveMessage(
        document,
        userId,
        'system',
        outcome.text,
      );
      outcome.messageId = saved?.id;
    }

    const usage = result.usage;
    this.logger.log(
      [
        `chat doc=${document.id}`,
        `mode=${wholeDocument ? 'document' : `passages(${passages?.length ?? 0})`}`,
        `history=${history.length}`,
        `context=${contextReadyAt - startedAt}ms`,
        `firstText=${firstTextAt ? `${firstTextAt - startedAt}ms` : '-'}`,
        `total=${Date.now() - startedAt}ms`,
        `in=${usage?.input_tokens ?? '-'}`,
        `cacheRead=${usage?.cache_read_input_tokens ?? '-'}`,
        `cacheWrite=${usage?.cache_creation_input_tokens ?? '-'}`,
        `out=${usage?.output_tokens ?? '-'}`,
        `status=${outcome.status}`,
        `model=${result.model ?? '-'}`,
      ].join(' '),
    );

    return outcome;
  }

  private saveMessage(
    document: CourseDocumentModel,
    userId: string,
    sender: 'user' | 'system',
    message: string,
    image?: string,
  ) {
    return this.documentMessageRepository.create({
      message,
      sender,
      image: image || undefined,
      openAiFileId: document.openAiFileId || ' ',
      openAiThreadId: ' ',
      userId,
      courseDocumentId: document.id,
    } as DocumentMessageModel);
  }

  /** Page text saved for Easy Read (PDFs). Kept for a few minutes: a chat asks many questions. */
  private async getPages(documentId: string): Promise<PageText[]> {
    const cached = this.pageCache.get(documentId);
    const ttl = cached?.pages.length ? PAGE_CACHE_MS : EMPTY_PAGE_CACHE_MS;
    if (cached && Date.now() - cached.at < ttl) return cached.pages;

    const rows =
      await this.simplifiedPageQueryService.findPageTexts(documentId);
    const pages = rows.map((row) => ({
      pageNumber: row.pageNumber,
      text: row.sourceText ?? '',
    }));

    this.forgetPages(documentId);
    const chars = pages.reduce((sum, page) => sum + page.text.length, 0);
    if (chars <= PAGE_CACHE_MAX_CHARS / 4) {
      this.pageCache.set(documentId, { at: Date.now(), pages, chars });
      this.pageCacheChars += chars;
      // Oldest first, until it fits.
      for (const key of this.pageCache.keys()) {
        if (this.pageCacheChars <= PAGE_CACHE_MAX_CHARS) break;
        this.forgetPages(key);
      }
    }
    return pages;
  }

  private forgetPages(documentId: string) {
    const entry = this.pageCache.get(documentId);
    if (!entry) return;
    this.pageCacheChars -= entry.chars;
    this.pageCache.delete(documentId);
  }
}
