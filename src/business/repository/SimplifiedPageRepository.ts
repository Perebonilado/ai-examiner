export const SimplifiedPageRepository = Symbol('SimplifiedPageRepository');

export interface NewSimplifiedPage {
  documentId: string;
  pageNumber: number;
  sourceText: string;
}

export interface SimplifiedPageRepository {
  /** Creates the page rows; rows that already exist (same document + page) are left as they are. */
  createPages(pages: NewSimplifiedPage[]): Promise<void>;
  /**
   * Marks a page as being worked on, if it's free to take: pending, failed with attempts left,
   * or "running" for longer than staleBefore (a worker that died). True when this caller got it.
   */
  claimPage(
    id: string,
    staleBefore: Date,
    maxAttempts: number,
  ): Promise<boolean>;
  completePage(id: string, content: string): Promise<void>;
  failPage(id: string): Promise<void>;
}
