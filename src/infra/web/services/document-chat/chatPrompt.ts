/**
 * Document chat: everything that decides what Claude is sent. Pure functions with no imports from
 * the rest of the app, so they can be unit tested on their own.
 */

export type ChatHighlight = 'explain' | 'simplify' | 'define';

export interface ChatNotSureQuestion {
  question: string;
  options?: string[];
  questionType?: string;
}

export interface ChatRequest {
  /** What the student sees as their message. */
  message: string;
  highlight?: { highlight: string; question: string };
  notSureQuestion?: ChatNotSureQuestion;
  /** An image the student found through image search ("Tell me more about this image"). */
  imageUrl?: string;
  /** Google Translate language code the app is shown in (e.g. "es"). */
  language?: string;
}

export interface PageText {
  pageNumber: number;
  text: string;
}

export interface Passage {
  /** Null when the document has no reliable page numbers (non-PDFs, merged pages). */
  pageNumber: number | null;
  text: string;
}

export interface HistoryMessage {
  sender: string;
  message: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Documents up to this size are sent whole (and cached) instead of searched. ~40k tokens. */
export const WHOLE_DOCUMENT_MAX_CHARS = 160_000;
/**
 * Text extraction merges pages once a PDF has more than 90, so from 90 rows on a row is no longer
 * one PDF page and its number can't be cited.
 */
export const MAX_RELIABLE_PAGES = 90;
/** Earlier messages sent with each question (4 exchanges). */
export const HISTORY_MESSAGES = 8;
/** A long earlier reply is cut to this many characters in the history sent to Claude. */
const HISTORY_MESSAGE_MAX_CHARS = 6_000;
const SEARCH_QUERY_MAX_CHARS = 1_500;

const optionLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/** Old replies were saved with the passages behind them; history never needs those. */
export const stripSourceText = (text: string) => {
  const start = text.indexOf('**source text start**');
  if (start === -1) return text.trim();
  const end = text.indexOf('**source text end**', start);
  const after =
    end === -1 ? '' : text.slice(end + '**source text end**'.length);
  return (text.slice(0, start) + after).trim();
};

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max).trimEnd()} …` : text;

/** True when the pages can be cited by number. */
export const pagesAreReliable = (pages: PageText[]) =>
  pages.length > 0 && pages.length < MAX_RELIABLE_PAGES;

/** The whole document goes into the (cached) system prompt when it's small enough. */
export const shouldSendWholeDocument = (pages: PageText[]) => {
  if (!pagesAreReliable(pages)) return false;
  const total = pages.reduce((sum, page) => sum + page.text.trim().length, 0);
  return total > 0 && total <= WHOLE_DOCUMENT_MAX_CHARS;
};

/**
 * The system prompt. It only depends on the document, so it is the same for every message about
 * that document and can be cached.
 */
export const buildSystemPrompt = ({
  title,
  summary,
  pages,
  wholeDocument,
  citePages,
}: {
  title: string;
  summary?: string | null;
  /** Every page, when the whole document is sent. */
  pages?: PageText[];
  wholeDocument: boolean;
  /** Page numbers are reliable, so the model can cite them. */
  citePages: boolean;
}) => {
  const lines = [
    `You are AI Examiner's study tutor. A student is studying the document "${title}" and is asking you about it.`,
    '',
    'How to answer:',
    '- Answer the question directly first, then explain. Use plain, simple words and explain any technical term the first time you use it. Add a short example or analogy when it helps.',
    wholeDocument
      ? '- Base your answer on the document below. When it does not cover something, say so briefly, then help from general knowledge and make clear that you are doing so.'
      : '- Base your answer on the passages from the document that come with each question. When they do not cover something, say so briefly, then help from general knowledge and make clear that you are doing so.',
    citePages
      ? '- When you use something from a page, cite it in square brackets right after, like [p. 4] or [pp. 4-5]. Only cite page numbers that appear in the document text you were given.'
      : '- Do not cite page numbers or sources.',
    '- If the student\'s message is short or vague ("yes", "go on", "tell me more"), treat it as a follow-up to your last reply, including any question you asked them.',
    '- Format with Markdown: short paragraphs, **bold** for key terms, and lists where they help. No HTML and no code blocks.',
    '- Be warm and encouraging, like a one-to-one tutor, and keep to what was asked.',
  ];

  if (summary?.trim()) {
    lines.push('', '<document_summary>', summary.trim(), '</document_summary>');
  }

  if (wholeDocument && pages?.length) {
    lines.push(
      '',
      'The full text of the document, page by page:',
      '<document>',
    );
    for (const page of pages) {
      if (!page.text.trim()) continue;
      lines.push(
        citePages ? `<page number="${page.pageNumber}">` : '<page>',
        page.text.trim(),
        '</page>',
      );
    }
    lines.push('</document>');
  }

  return lines.join('\n');
};

/** What the student asked for, as instructions for this one reply. */
export const buildTask = (request: ChatRequest): string | null => {
  const { highlight, notSureQuestion, imageUrl } = request;

  if (imageUrl) {
    return [
      `The student found the attached image while searching for "${clip(request.message, 300)}" and wants to know more about it.`,
      'Describe what the image shows, then connect it to the document they are studying: what it illustrates and why it matters there. If it has no real connection to the document, say so politely.',
      'Keep it brief and conversational, but keep the key scientific terms.',
    ].join('\n');
  }

  if (notSureQuestion?.question) {
    const { question, options = [], questionType } = notSureQuestion;
    const optionLines = options
      .map((option, i) => `${optionLetters[i] ?? i + 1}. ${option}`)
      .join('\n');

    if (questionType === 'Multiple Choice') {
      return [
        'The student is unsure about this multiple-choice practice question. Only one option is correct.',
        `<question>${question}</question>`,
        `<options>\n${optionLines}\n</options>`,
        'Start by saying which option is correct. Then go through every option, the correct one first: say why it is right or wrong in simple terms, quote the document briefly where it helps, and point out anything that makes a wrong option look right.',
        'Put a horizontal rule (---) between the options.',
      ].join('\n');
    }

    if (questionType === 'Multiple True-False') {
      return [
        'The student is unsure about this true-or-false practice question. Each statement may be true or false.',
        `<question>${question}</question>`,
        `<statements>\n${optionLines}\n</statements>`,
        'Start by listing which statements are true and which are false. Then explain each one, true statements first: why it is true or false in simple terms, with a short quote from the document where it helps, and what might make it look right when it is not.',
        'Put a horizontal rule (---) between the statements.',
      ].join('\n');
    }

    return null;
  }

  if (highlight?.question?.trim()) {
    const text = `<highlighted_text>${clip(highlight.question.trim(), 4_000)}</highlighted_text>`;
    switch (highlight.highlight) {
      case 'define':
        return [
          'The student highlighted this in the document and asked what it means:',
          text,
          'Define it as it is used in this document, not as a stand-alone idea. Show how it is used or applied, with an example. If it has more than one meaning or is easy to confuse, point that out.',
        ].join('\n');
      case 'explain':
        return [
          'The student highlighted this in the document and asked you to explain it:',
          text,
          'Explain it in the context of this document: what it means and why it matters here. If it is a process, describe the steps in order. Use simple words and short examples.',
        ].join('\n');
      case 'simplify':
        return [
          'The student highlighted this in the document and is struggling to understand it:',
          text,
          'Make it as easy as possible to understand, in the context of this document. Use very basic language and a relatable example, and leave out technical words unless you explain them simply.',
        ].join('\n');
      default:
        return null;
    }
  }

  return null;
};

const languageName = (code?: string) => {
  if (!code || code === 'en' || !/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(code)) {
    return null;
  }
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(code);
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
};

/** The final user turn: passages (when searching), the task, and the question. */
export const buildUserTurn = ({
  request,
  passages,
}: {
  request: ChatRequest;
  /** Null in whole-document mode. */
  passages: Passage[] | null;
}) => {
  const parts: string[] = [];

  if (passages) {
    if (passages.length) {
      parts.push(
        '<passages>',
        ...passages.map((passage) =>
          [
            passage.pageNumber
              ? `<passage page="${passage.pageNumber}">`
              : '<passage>',
            passage.text.trim(),
            '</passage>',
          ].join('\n'),
        ),
        '</passages>',
      );
    } else {
      parts.push('(No passages from the document matched this question.)');
    }
    parts.push('');
  }

  const task = buildTask(request);
  if (task) {
    parts.push(task);
  } else {
    parts.push(`Student's message: ${request.message.trim()}`);
  }

  const language = languageName(request.language);
  if (language) {
    parts.push('', `Write your reply in ${language}.`);
  }

  return parts.join('\n');
};

/** A whole message that only makes sense after the previous reply. */
const FOLLOW_UP =
  /^(yes|yeah|yep|no|nope|ok(ay)?|sure|go on|continue|more|tell me more|why|how|and|what else|what next|explain more|explain further|again|example|an example|give me an example|another example)[\s.!?]*$/i;

/** Words that point back at the conversation ("why is it important?", "what does that mean?"). */
const REFERS_BACK =
  /\b(it|its|this|that|these|those|they|them|their|he|she|him|her|the above|you said|your answer)\b/i;

/** A message that only makes sense after the previous reply. */
export const isFollowUp = (message: string) => {
  const words = message.split(/\s+/).filter(Boolean).length;
  return (
    FOLLOW_UP.test(message) ||
    words <= 2 ||
    (words <= 10 && REFERS_BACK.test(message))
  );
};

/**
 * What to search the document for. Highlights and practice questions search for their own text;
 * a short follow-up ("go on", "why?") also searches for what it follows up on, so it finds the
 * same part of the document instead of nothing useful.
 */
export const buildSearchQuery = (
  request: ChatRequest,
  history: HistoryMessage[],
) => {
  if (request.highlight?.question?.trim()) {
    return clip(request.highlight.question.trim(), SEARCH_QUERY_MAX_CHARS);
  }

  if (request.notSureQuestion?.question) {
    const { question, options = [] } = request.notSureQuestion;
    return clip([question, ...options].join('\n'), SEARCH_QUERY_MAX_CHARS);
  }

  const message = request.message.trim();
  if (!isFollowUp(message)) return clip(message, SEARCH_QUERY_MAX_CHARS);

  const lastUser = [...history].reverse().find((m) => m.sender === 'user');
  const lastReply = [...history].reverse().find((m) => m.sender !== 'user');
  const context = [
    lastUser ? clip(stripSourceText(lastUser.message), 400) : '',
    lastReply ? clip(stripSourceText(lastReply.message), 400) : '',
  ].filter(Boolean);

  return clip([message, ...context].join('\n'), SEARCH_QUERY_MAX_CHARS);
};

/** Earlier messages as conversation turns, without old passages and with long replies cut. */
export const historyToTurns = (history: HistoryMessage[]): ChatTurn[] =>
  history
    .map((m) => ({
      role: (m.sender === 'user' ? 'user' : 'assistant') as ChatTurn['role'],
      content: clip(
        stripSourceText(m.message ?? ''),
        HISTORY_MESSAGE_MAX_CHARS,
      ),
    }))
    .filter((turn) => turn.content.length > 0);

/** Matches search hits to their page (hits are whole pages of text). */
export const passagesFromHits = (
  hits: string[],
  pages: PageText[],
): Passage[] => {
  const reliable = pagesAreReliable(pages);
  const byText = new Map<string, number>();
  if (reliable) {
    for (const page of pages) {
      const key = page.text.trim();
      if (key && !byText.has(key)) byText.set(key, page.pageNumber);
    }
  }
  const seen = new Set<string>();
  const passages: Passage[] = [];
  for (const hit of hits) {
    const text = (hit ?? '').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    passages.push({ pageNumber: byText.get(text) ?? null, text });
  }
  // Reading order reads better than relevance order once the set is chosen (unnumbered last).
  return passages.sort(
    (a, b) =>
      (a.pageNumber ?? Number.MAX_SAFE_INTEGER) -
      (b.pageNumber ?? Number.MAX_SAFE_INTEGER),
  );
};

/** For the "Reading pages 3, 7, 12" status while the reply starts. */
export const citedPageNumbers = (passages: Passage[]) =>
  Array.from(
    new Set(
      passages
        .map((p) => p.pageNumber)
        .filter((n): n is number => typeof n === 'number'),
    ),
  ).sort((a, b) => a - b);

/** How hard the model thinks: practice questions need reasoning, chat needs speed. */
export const effortFor = (request: ChatRequest): 'low' | 'medium' =>
  request.notSureQuestion?.questionType === 'Multiple Choice' ||
  request.notSureQuestion?.questionType === 'Multiple True-False'
    ? 'medium'
    : 'low';

const MAX_MESSAGE_CHARS = 20_000;
const HIGHLIGHTS: ChatHighlight[] = ['explain', 'simplify', 'define'];

/** Why a request body can't be answered, or null when it can. */
export const chatRequestProblem = (body: unknown): string | null => {
  const message = (body as Record<string, any> | null)?.message;
  if (typeof message !== 'string' || !message.trim())
    return 'Type a message to send';
  if (message.length > MAX_MESSAGE_CHARS) {
    return 'That message is too long. Try a shorter one.';
  }
  return null;
};

/** The request body as a ChatRequest, or null when it has no usable message. */
export const parseChatRequest = (body: unknown): ChatRequest | null => {
  if (chatRequestProblem(body)) return null;
  const b = body as Record<string, any>;

  const request: ChatRequest = { message: b.message };

  const h = b.highlightToPrompt;
  if (h && typeof h.question === 'string' && HIGHLIGHTS.includes(h.highlight)) {
    request.highlight = { highlight: h.highlight, question: h.question };
  }

  const q = b.notSureQuestion;
  if (q && typeof q.question === 'string' && q.question.trim()) {
    request.notSureQuestion = {
      question: q.question,
      options: Array.isArray(q.options)
        ? q.options.filter((o: unknown) => typeof o === 'string')
        : [],
      questionType:
        typeof q.questionType === 'string' ? q.questionType : undefined,
    };
  }

  const imageUrl = b.imageDescriptionData?.imageUrl;
  if (typeof imageUrl === 'string' && imageUrl.trim()) {
    request.imageUrl = imageUrl.trim();
  }

  if (typeof b.language === 'string') request.language = b.language;
  return request;
};

/** One server-sent event. */
export const sseEvent = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
