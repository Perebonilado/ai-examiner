import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { pdfMimeType } from 'src/constants';
import { getTextSimplificationPrompt } from 'src/constants/QuestionGenerationPromptV2';
import { SimplifiedPDFArraySchema } from 'src/schemas/SimplifiedPDFSchema';
import { generateHTMLFromContent, PDFContent } from 'src/utils';
import { AI } from 'src/integrations/vercel-ai/services/AI';
import { CLAUDE_CONN } from 'src/integrations/vercel-ai/services/ClaudeConn';
import { ExtractTextService } from 'src/integrations/text-extraction/services/ExtractTextService';
import { StoredFileQueryService } from 'src/query/services/StoredFileQueryService';
import { DocumentSummaryQueryService } from 'src/query/services/DocumentSummaryQueryService';
import { SimplifiedPageQueryService } from 'src/query/services/SimplifiedPageQueryService';
import { SimplifiedPageRepository } from 'src/business/repository/SimplifiedPageRepository';
import { UpdateStoredFileHandler } from 'src/business/handlers/StoredFile/UpdateStoredFileHandler';
import { StoredFileModel } from 'src/infra/db/models/StoredFileModel';
import { SimplifiedPageModel } from 'src/infra/db/models/SimplifiedPageModel';
import { DocumentPdfService } from './DocumentPdfService';
import { isClaimable, isFinallyFailed, orderPagesForWork } from './pageWork';

/** Pages simplified at the same time for one document (the model and prompt are unchanged). */
const CONCURRENCY = 8;
const MAX_ATTEMPTS = 3;
/** A page "running" longer than this was left by a worker that stopped (e.g. a restart). */
const STALE_RUNNING_MS = 3 * 60_000;

export type SimplifiedPagesStatus = 'preparing' | 'working' | 'ready';

export interface SimplifiedPagesResponse {
  status: SimplifiedPagesStatus;
  /** Null while the document's pages are still being read. */
  totalPages: number | null;
  pages: {
    pageNumber: number;
    status: 'pending' | 'running' | 'done' | 'failed';
    /** Simplified page HTML, for done pages the app doesn't have yet. */
    html?: string;
  }[];
}

interface Job {
  priority: number;
  promise: Promise<void>;
}

/**
 * Easy Read simplification, one page at a time:
 * - each page's text is stored (at upload for PDFs, otherwise on first open), then simplified on
 *   its own and saved as soon as it's done, so the reader can show pages as they arrive;
 * - up to CONCURRENCY pages run at once, starting with the page the reader is looking at;
 * - pages are claimed in the database, so overlapping requests never simplify a page twice;
 * - when every page is done the whole document is also saved on the stored file, which the older
 *   endpoints (modified-content, modified-document-file) and the mobile app read.
 */
@Injectable()
export class EasyReadSimplificationService {
  private readonly logger = new Logger(EasyReadSimplificationService.name);
  private readonly jobs = new Map<string, Job>();
  private readonly preparing = new Map<string, Promise<void>>();

  constructor(
    @Inject(StoredFileQueryService)
    private storedFileQueryService: StoredFileQueryService,
    @Inject(SimplifiedPageQueryService)
    private simplifiedPageQueryService: SimplifiedPageQueryService,
    @Inject(SimplifiedPageRepository)
    private simplifiedPageRepository: SimplifiedPageRepository,
    @Inject(DocumentSummaryQueryService)
    private documentSummaryQueryService: DocumentSummaryQueryService,
    @Inject(ExtractTextService) private extractTextService: ExtractTextService,
    @Inject(DocumentPdfService) private documentPdfService: DocumentPdfService,
    @Inject(UpdateStoredFileHandler)
    private updateStoredFileHandler: UpdateStoredFileHandler,
    @Inject(CLAUDE_CONN) private readonly claudeConn: AI,
  ) {}

  /** Stores each page's text (no AI calls). Pages that already exist are left alone. */
  public async savePageText(documentId: string, pages: string[]) {
    await this.simplifiedPageRepository.createPages(
      pages.map((sourceText, index) => ({
        documentId,
        pageNumber: index + 1,
        sourceText: sourceText ?? '',
      })),
    );
  }

  /**
   * Where simplification stands, plus the HTML of finished pages the app doesn't have yet.
   * Starts (or re-prioritises) the work without waiting for it.
   */
  public async getProgress(
    documentId: string,
    title: string,
    priority: number,
    have: Set<number>,
  ): Promise<SimplifiedPagesResponse> {
    const storedFile = await this.getStoredFile(documentId);

    const legacy = this.parseContent(storedFile.modifiedContent);
    if (legacy.length) {
      return {
        status: 'ready',
        totalPages: legacy.length,
        pages: legacy.map((content, index) => ({
          pageNumber: index + 1,
          status: 'done',
          html: have.has(index + 1)
            ? undefined
            : generateHTMLFromContent([content]),
        })),
      };
    }

    const rows =
      await this.simplifiedPageQueryService.findStatusesByDocumentId(
        documentId,
      );
    if (!rows.length) {
      // Reading the document's pages can take a few seconds (download, conversion, OCR):
      // do it in the background and let the app ask again.
      this.prepareThenStart(documentId, storedFile, title, priority);
      return { status: 'preparing', totalPages: null, pages: [] };
    }

    if (rows.some((row) => this.needsWork(row))) {
      this.start(documentId, storedFile, priority);
    }

    const wanted = rows
      .filter((row) => row.status === 'done' && !have.has(row.pageNumber))
      .map((row) => row.pageNumber);
    const contents = wanted.length
      ? await this.simplifiedPageQueryService.findDoneContent(
          documentId,
          wanted,
        )
      : [];
    const htmlByPage = new Map(
      contents.map((c) => [
        c.pageNumber,
        generateHTMLFromContent([this.parsePage(c.content)]),
      ]),
    );

    return {
      status: rows.some((row) => this.needsWork(row)) ? 'working' : 'ready',
      totalPages: rows.length,
      pages: rows.map((row) => ({
        pageNumber: row.pageNumber,
        // A failed page that will be retried is still in progress.
        status:
          row.status === 'failed' && !isFinallyFailed(row, MAX_ATTEMPTS)
            ? 'pending'
            : row.status,
        html: htmlByPage.get(row.pageNumber),
      })),
    };
  }

  /** Simplifies every page and returns the whole document (for the older all-at-once endpoints). */
  public async getWholeDocument(
    documentId: string,
    title: string,
  ): Promise<PDFContent[][]> {
    const storedFile = await this.getStoredFile(documentId);
    const legacy = this.parseContent(storedFile.modifiedContent);
    if (legacy.length) return legacy;

    await this.preparePages(documentId, storedFile, title);
    await this.start(documentId, storedFile, 1);

    const rows =
      await this.simplifiedPageQueryService.findStatusesByDocumentId(
        documentId,
      );
    const contents =
      await this.simplifiedPageQueryService.findDoneContent(documentId);
    const byPage = new Map(
      contents.map((c) => [c.pageNumber, this.parsePage(c.content)]),
    );
    return rows.map((row) => byPage.get(row.pageNumber) ?? []);
  }

  private async getStoredFile(documentId: string) {
    const storedFile =
      await this.storedFileQueryService.findByDocumentId(documentId);
    if (!storedFile?.originalFileId) {
      throw new HttpException('Document file not found', HttpStatus.NOT_FOUND);
    }
    return storedFile;
  }

  private needsWork(row: SimplifiedPageModel) {
    return row.status !== 'done' && !isFinallyFailed(row, MAX_ATTEMPTS);
  }

  /** Extracts and stores the page text once per document (shared by overlapping requests). */
  private async preparePages(
    documentId: string,
    storedFile: StoredFileModel,
    title: string,
  ) {
    const existing =
      await this.simplifiedPageQueryService.findStatusesByDocumentId(
        documentId,
      );
    if (existing.length) return;

    let preparing = this.preparing.get(documentId);
    if (!preparing) {
      preparing = (async () => {
        const started = Date.now();
        // Always read the PDF, so simplified pages line up with the Original view's pages.
        const pdf = await this.documentPdfService.getPdf(storedFile);
        const pages =
          await this.extractTextService.getChunksBasedOnFileMimeType({
            buffer: pdf,
            mimetype: pdfMimeType,
            originalName: title || 'document',
          });
        await this.savePageText(documentId, pages);
        this.logger.log(
          `Read ${pages.length} pages of ${documentId} in ${Date.now() - started}ms`,
        );
      })().finally(() => this.preparing.delete(documentId));
      this.preparing.set(documentId, preparing);
    }
    await preparing;
  }

  private prepareThenStart(
    documentId: string,
    storedFile: StoredFileModel,
    title: string,
    priority: number,
  ) {
    this.preparePages(documentId, storedFile, title)
      .then(() => this.start(documentId, storedFile, priority))
      .catch((error) =>
        this.logger.error(
          `Could not prepare pages for ${documentId}: ${error?.message}`,
        ),
      );
  }

  /** Starts simplifying the remaining pages, or points a running job at a new page. */
  private start(
    documentId: string,
    storedFile: StoredFileModel,
    priority: number,
  ): Promise<void> {
    const running = this.jobs.get(documentId);
    if (running) {
      running.priority = priority;
      return running.promise;
    }
    const job: Job = { priority, promise: Promise.resolve() };
    job.promise = this.run(documentId, storedFile, job)
      .catch((error) =>
        this.logger.error(
          `Simplification failed for ${documentId}: ${error?.message}`,
        ),
      )
      .finally(() => this.jobs.delete(documentId));
    this.jobs.set(documentId, job);
    return job.promise;
  }

  private async run(documentId: string, storedFile: StoredFileModel, job: Job) {
    const started = Date.now();
    const summary =
      (await this.documentSummaryQueryService.findByDocumentId(documentId))
        ?.summary ?? '';

    const counts = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        this.worker(documentId, summary, job),
      ),
    );
    const simplified = counts.reduce((a, b) => a + b, 0);
    if (simplified) {
      this.logger.log(
        `Simplified ${simplified} pages of ${documentId} in ${Date.now() - started}ms`,
      );
    }
    await this.saveWholeDocumentIfComplete(documentId, storedFile.id);
  }

  /** Takes pages one after another until none are left; returns how many it finished. */
  private async worker(documentId: string, summary: string, job: Job) {
    let finished = 0;
    for (;;) {
      const page = await this.claimNext(documentId, job.priority);
      if (!page) return finished;
      const started = Date.now();
      try {
        const source = await this.simplifiedPageQueryService.findSourceTextById(
          page.id,
        );
        const text = source?.sourceText ?? '';
        // Pages without text (a picture, a title slide) don't need the model.
        const content = text.trim().length
          ? await this.simplify(text, summary)
          : [];
        await this.simplifiedPageRepository.completePage(
          page.id,
          JSON.stringify(content),
        );
        finished++;
        this.logger.debug(
          `Page ${page.pageNumber} of ${documentId}: ${Date.now() - started}ms`,
        );
      } catch (error) {
        this.logger.warn(
          `Page ${page.pageNumber} of ${documentId} failed: ${error?.message}`,
        );
        await this.simplifiedPageRepository
          .failPage(page.id)
          .catch(() => undefined);
      }
    }
  }

  private async claimNext(documentId: string, priority: number) {
    const rows =
      await this.simplifiedPageQueryService.findStatusesByDocumentId(
        documentId,
      );
    const staleBefore = new Date(Date.now() - STALE_RUNNING_MS);
    const candidates = rows.filter((row) =>
      isClaimable(row, staleBefore, MAX_ATTEMPTS),
    );
    const byPage = new Map(candidates.map((row) => [row.pageNumber, row]));
    for (const pageNumber of orderPagesForWork([...byPage.keys()], priority)) {
      const row = byPage.get(pageNumber);
      if (
        await this.simplifiedPageRepository.claimPage(
          row.id,
          staleBefore,
          MAX_ATTEMPTS,
        )
      ) {
        return row;
      }
    }
    return null;
  }

  private async simplify(text: string, summary: string) {
    const response = await this.claudeConn.generateObject({
      schemaName: 'simplified',
      schema: SimplifiedPDFArraySchema,
      messages: [
        { role: 'system', content: getTextSimplificationPrompt(summary) },
        {
          role: 'user',
          content: `
            **source text start**
            ${text}
            **source text end**
            `,
        },
      ],
    });
    return response.object.simplifiedContent as PDFContent[];
  }

  private async saveWholeDocumentIfComplete(
    documentId: string,
    storedFileId: string,
  ) {
    const rows =
      await this.simplifiedPageQueryService.findStatusesByDocumentId(
        documentId,
      );
    if (!rows.length || rows.some((row) => row.status !== 'done')) return;
    const contents =
      await this.simplifiedPageQueryService.findDoneContent(documentId);
    await this.updateStoredFileHandler.handle({
      id: storedFileId,
      modifiedContent: contents.map((c) => this.parsePage(c.content)),
    });
  }

  private parseContent(value: string | null | undefined): PDFContent[][] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private parsePage(value: string | null | undefined): PDFContent[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
