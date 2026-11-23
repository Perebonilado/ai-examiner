import { select } from '../sql';
import { LabelKind } from './models';

/**
 * Finds the things to label (chat conversations, test attempts, essays, documents) and writes
 * each one out as plain text for Claude. Emails and phone numbers are removed first; long
 * assistant answers are shortened, with the cut marked.
 */

export interface LabelItem {
  kind: LabelKind;
  /** item_key in ai_label. */
  key: string;
  userId: string | null;
  documentId: string | null;
  occurredOn: Date;
  /** The text Claude reads. */
  content: string;
  /** Facts kept on the label (test status and score...). */
  details?: Record<string, unknown>;
}

/** A gap longer than this between chat messages starts a new conversation. */
export const CONVERSATION_GAP_MS = 30 * 60 * 1000;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+?\d[\d\s().-]{8,}\d)/g;

/** Removes email addresses and phone numbers. */
export const redact = (text: string) =>
  (text || '')
    .replace(EMAIL, '[email]')
    .replace(PHONE, (m) => (m.replace(/\D/g, '').length >= 10 ? '[phone]' : m));

/** Keeps the first `max` characters and marks the cut. */
export const shorten = (text: string, max: number, mark = '[…shortened]') => {
  const t = (text || '').trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()} ${mark}` : t;
};

const watDate = (d: Date) =>
  new Date(d.getTime() + 3600_000).toISOString().slice(0, 16).replace('T', ' ');

const parseJson = (value: unknown): any => {
  let v = value;
  for (let i = 0; i < 3 && typeof v === 'string'; i++) {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v;
};

const toDate = (v: Date | string) =>
  v instanceof Date ? v : new Date(String(v).replace(' ', 'T') + 'Z');

/** Item keys that already have a label (or one on the way). Failed ones are tried again. */
async function labelledKeys(kind: LabelKind, keys: string[]) {
  if (!keys.length) return new Set<string>();
  const rows = await select<{ item_key: string }>(
    `SELECT item_key FROM ai_label WHERE kind = :kind AND item_key IN (:keys) AND status <> 'failed'`,
    { kind, keys },
  );
  return new Set(rows.map((r) => r.item_key));
}

async function titlesOf(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, string>();
  const rows = await select<{ id: string; title: string }>(
    `SELECT id, title FROM course_document WHERE id IN (:ids)`,
    { ids: unique },
  );
  return new Map(rows.map((r) => [r.id, r.title]));
}

/* ---------- Chat ---------- */

export interface ChatMessageRow {
  id: string;
  user_id: string;
  course_document_id: string;
  created_on: Date | string;
  sender: string;
  message: string;
  has_image: number;
}

export interface Conversation {
  key: string;
  userId: string;
  documentId: string;
  startedOn: Date;
  endedOn: Date;
  messages: ChatMessageRow[];
}

/** Splits one person's messages on one document into conversations (30 minutes of quiet ends one). */
export function groupConversations(rows: ChatMessageRow[]): Conversation[] {
  const out: Conversation[] = [];
  let current: Conversation | null = null;
  for (const r of rows) {
    const at = toDate(r.created_on);
    if (
      !current ||
      current.userId !== r.user_id ||
      current.documentId !== r.course_document_id ||
      at.getTime() - current.endedOn.getTime() > CONVERSATION_GAP_MS
    ) {
      current = {
        key: r.id,
        userId: r.user_id,
        documentId: r.course_document_id,
        startedOn: at,
        endedOn: at,
        messages: [],
      };
      out.push(current);
    }
    current.messages.push(r);
    current.endedOn = at;
  }
  return out;
}

/** The transcript Claude reads: student messages in full (up to a limit), answers shortened. */
export function conversationText(c: Conversation, title: string | undefined) {
  const lines = c.messages.map((m) => {
    const who = m.sender === 'user' ? 'Student' : 'Assistant';
    const body =
      m.sender === 'user'
        ? shorten(redact(m.message), 1500)
        : shorten(redact(m.message), 900, '[…answer shortened]');
    return `${who}: ${body}${Number(m.has_image) ? ' [sent a picture]' : ''}`;
  });
  const shown =
    lines.length > 40
      ? [
          ...lines.slice(0, 20),
          `[… ${lines.length - 40} messages left out …]`,
          ...lines.slice(-20),
        ]
      : lines;
  return [
    `Document: ${title ? redact(title) : 'unknown'}`,
    `Conversation started ${watDate(c.startedOn)} (Lagos time), ${c.messages.length} messages.`,
    '',
    ...shown,
  ].join('\n');
}

export async function chatMessages(start: Date, end: Date) {
  return select<ChatMessageRow>(
    `SELECT id, user_id, course_document_id, created_on, sender, LEFT(message, 3000) AS message,
            (image IS NOT NULL AND image <> '') AS has_image
     FROM document_message WHERE created_on >= :start AND created_on < :end
     ORDER BY user_id, course_document_id, created_on, id`,
    { start, end },
  );
}

export async function collectChats(
  start: Date,
  end: Date,
  settledBefore: Date,
): Promise<LabelItem[]> {
  const conversations = groupConversations(
    await chatMessages(start, end),
  ).filter(
    (c) =>
      c.messages.some((m) => m.sender === 'user') && c.endedOn < settledBefore,
  );
  const done = await labelledKeys(
    'chat',
    conversations.map((c) => c.key),
  );
  const todo = conversations.filter((c) => !done.has(c.key));
  const titles = await titlesOf(todo.map((c) => c.documentId));
  return todo.map((c) => ({
    kind: 'chat' as const,
    key: c.key,
    userId: c.userId,
    documentId: c.documentId,
    occurredOn: c.startedOn,
    content: conversationText(c, titles.get(c.documentId)),
    details: { messages: c.messages.length },
  }));
}

/* ---------- Tests ---------- */

export const TEST_TYPES: Record<number, string> = {
  3: 'Multiple choice',
  4: 'Flashcards',
  5: 'True/false',
  6: 'Oral viva',
  7: 'Essay',
};

interface TestQuestion {
  id: string;
  question: string;
  options?: { id: string; value: string; answer?: boolean }[];
  correctAnswerId?: string;
  topic?: string;
}

interface ProgressAnswer {
  selectedQuestionId: string;
  selectedOptionId?: string;
  selectedAnswer?: boolean;
}

export interface MarkedAnswer {
  questionId: string;
  index: number;
  question: string;
  topic: string;
  chosen: string;
  correct: string;
  right: boolean | null;
}

/** Each answered question with what the student chose and whether it was right, in test order. */
export function markAnswers(
  test: TestQuestion[],
  progress: ProgressAnswer[],
): MarkedAnswer[] {
  const byId = new Map(test.map((q, i) => [q.id, { q, i }]));
  const grouped = new Map<string, ProgressAnswer[]>();
  for (const p of progress) {
    if (!p?.selectedQuestionId) continue;
    if (!grouped.has(p.selectedQuestionId))
      grouped.set(p.selectedQuestionId, []);
    grouped.get(p.selectedQuestionId)!.push(p);
  }
  const out: MarkedAnswer[] = [];
  for (const [qid, answers] of grouped) {
    const hit = byId.get(qid);
    if (!hit) continue;
    const { q, i } = hit;
    const options = q.options ?? [];
    const isTrueFalse = options.some((o) => typeof o.answer === 'boolean');
    if (isTrueFalse) {
      // True/false: each statement is judged true or false.
      let right = 0;
      const parts: string[] = [];
      for (const o of options) {
        const a = answers.find((x) => x.selectedOptionId === o.id);
        if (!a || typeof a.selectedAnswer !== 'boolean') continue;
        const ok = a.selectedAnswer === o.answer;
        if (ok) right++;
        parts.push(
          `${shorten(o.value, 80)} → ${a.selectedAnswer ? 'true' : 'false'}${ok ? '' : ' (wrong)'}`,
        );
      }
      out.push({
        questionId: qid,
        index: i,
        question: q.question,
        topic: q.topic ?? '',
        chosen: parts.join('; '),
        correct: `${right} of ${options.length} statements right`,
        right: right === options.length,
      });
      continue;
    }
    const chosen = options.find((o) => o.id === answers[0]?.selectedOptionId);
    const correct = options.find((o) => o.id === q.correctAnswerId);
    out.push({
      questionId: qid,
      index: i,
      question: q.question,
      topic: q.topic ?? '',
      chosen: chosen?.value ?? '(no answer)',
      correct: correct?.value ?? '',
      right:
        chosen && q.correctAnswerId ? chosen.id === q.correctAnswerId : null,
    });
  }
  return out.sort((a, b) => a.index - b.index);
}

export interface AttemptRow {
  id: string;
  user_id: string;
  question_id: string;
  status: string;
  modified_on: Date | string;
  progress: unknown;
  test: unknown;
  question_type_id: number;
  course_document_id: string;
}

export function attemptText(
  row: AttemptRow,
  title: string | undefined,
  score: number | null,
  flagged: string[],
) {
  const test = (parseJson(row.test) ?? []) as TestQuestion[];
  const marked = markAnswers(
    test,
    (parseJson(row.progress) ?? []) as ProgressAnswer[],
  );
  const finished = row.status === 'submitted';
  const flaggedIndexes = flagged
    .map((id) => test.findIndex((q) => q.id === id))
    .filter((i) => i >= 0)
    .map((i) => `question ${i + 1}`);
  const lines = marked.map(
    (m) =>
      `${m.index + 1}. [${m.topic || 'no topic'}] ${shorten(redact(m.question), 220)}\n   Student: ${shorten(
        redact(m.chosen),
        200,
      )}${m.correct ? ` | correct: ${shorten(redact(m.correct), 160)}` : ''}${
        m.right === null ? '' : m.right ? ' | right' : ' | wrong'
      }`,
  );
  return {
    marked,
    total: test.length,
    text: [
      `Test type: ${TEST_TYPES[row.question_type_id] ?? 'Test'}. Made from: ${title ? redact(title) : 'unknown'}. ${test.length} questions.`,
      finished
        ? `Status: finished${score !== null ? ` with a score of ${Math.round(score)}%` : ''}.`
        : `Status: stopped after answering ${marked.length} of ${test.length} questions, and hasn't finished it.`,
      ...(flaggedIndexes.length
        ? [`The student flagged ${flaggedIndexes.join(', ')} as a problem.`]
        : []),
      '',
      'Answers, in test order:',
      ...lines,
    ].join('\n'),
  };
}

export async function attemptRows(start: Date, end: Date) {
  return select<AttemptRow>(
    `SELECT qp.id, qp.user_id, qp.question_id, qp.status, qp.modified_on, qp.data AS progress,
            q.data AS test, q.question_type_id, q.course_document_id
     FROM question_progress qp JOIN question q ON q.id = qp.question_id
     WHERE qp.modified_on >= :start AND qp.modified_on < :end`,
    { start, end },
  );
}

export async function scoresFor(questionIds: string[]) {
  if (!questionIds.length) return new Map<string, number>();
  const rows = await select<{
    question_id: string;
    user_id: string;
    s: number;
  }>(
    `SELECT question_id, user_id, MAX(percentage_score) AS s FROM score WHERE question_id IN (:ids)
     GROUP BY question_id, user_id`,
    { ids: questionIds },
  );
  return new Map(
    rows.map((r) => [`${r.question_id}|${r.user_id}`, Number(r.s)]),
  );
}

export async function flagsFor(questionIds: string[]) {
  if (!questionIds.length) return new Map<string, string[]>();
  const rows = await select<{ test_id: string; selected_question_id: string }>(
    `SELECT test_id, selected_question_id FROM flagged_question WHERE test_id IN (:ids)`,
    { ids: questionIds },
  );
  const map = new Map<string, string[]>();
  for (const r of rows) {
    if (!map.has(r.test_id)) map.set(r.test_id, []);
    map.get(r.test_id)!.push(r.selected_question_id);
  }
  return map;
}

export async function collectTests(
  start: Date,
  end: Date,
  settledBefore: Date,
): Promise<LabelItem[]> {
  const rows = (await attemptRows(start, end)).filter(
    (r) => r.status === 'submitted' || toDate(r.modified_on) < settledBefore,
  );
  const done = await labelledKeys(
    'test',
    rows.map((r) => r.id),
  );
  const todo = rows.filter((r) => !done.has(r.id));
  const ids = todo.map((r) => r.question_id);
  const [titles, scores, flags] = await Promise.all([
    titlesOf(todo.map((r) => r.course_document_id)),
    scoresFor(ids),
    flagsFor(ids),
  ]);
  const items: LabelItem[] = [];
  for (const r of todo) {
    const score = scores.get(`${r.question_id}|${r.user_id}`) ?? null;
    const { marked, total, text } = attemptText(
      r,
      titles.get(r.course_document_id),
      score,
      flags.get(r.question_id) ?? [],
    );
    if (marked.length < 3) continue;
    items.push({
      kind: 'test',
      key: r.id,
      userId: r.user_id,
      documentId: r.course_document_id,
      occurredOn: toDate(r.modified_on),
      content: text,
      details: {
        testId: r.question_id,
        testType: TEST_TYPES[r.question_type_id] ?? 'Test',
        status: r.status === 'submitted' ? 'finished' : 'stopped',
        score,
        answered: marked.length,
        total,
        right: marked.filter((m) => m.right).length,
      },
    });
  }
  return items;
}

export async function collectEssays(
  start: Date,
  end: Date,
): Promise<LabelItem[]> {
  const rows = await select<{
    id: number;
    question: string;
    answer: string;
    analysis: string;
    score: number | null;
    created_on: Date | string;
    question_id: string;
    user_id: string;
    course_document_id: string;
  }>(
    `SELECT e.id, LEFT(e.question, 1500) AS question, LEFT(e.answer, 2500) AS answer, LEFT(e.analysis, 1500) AS analysis,
            e.score, e.created_on, e.question_id, q.user_id, q.course_document_id
     FROM essay_question_analysis e JOIN question q ON q.id = e.question_id
     WHERE e.created_on >= :start AND e.created_on < :end`,
    { start, end },
  );
  const keyOf = (id: number) => `essay:${id}`;
  const done = await labelledKeys(
    'test',
    rows.map((r) => keyOf(r.id)),
  );
  const todo = rows.filter((r) => !done.has(keyOf(r.id)));
  const titles = await titlesOf(todo.map((r) => r.course_document_id));
  return todo.map((r) => ({
    kind: 'test' as const,
    key: keyOf(r.id),
    userId: r.user_id,
    documentId: r.course_document_id,
    occurredOn: toDate(r.created_on),
    content: [
      `Test type: Essay. Made from: ${redact(titles.get(r.course_document_id) ?? 'unknown')}.`,
      `Status: finished; the app gave a score of ${r.score ?? 'none'}.`,
      '',
      `Essay question: ${shorten(redact(r.question), 1200)}`,
      '',
      `Student's answer: ${shorten(redact(r.answer || '(empty)'), 2000)}`,
      '',
      `App's marking: ${shorten(redact(r.analysis || ''), 1200)}`,
    ].join('\n'),
    details: {
      testId: r.question_id,
      testType: 'Essay',
      status: 'finished',
      score: r.score,
    },
  }));
}

/* ---------- Documents ---------- */

export async function documentFacts(ids: string[]) {
  if (!ids.length)
    return {
      topics: new Map<string, string[]>(),
      summaries: new Map<string, string>(),
    };
  const [topicRows, summaryRows] = await Promise.all([
    select<{ document_id: string; title: string }>(
      `SELECT document_id, title FROM document_topic WHERE document_id IN (:ids) ORDER BY document_id, startPage, id`,
      { ids },
    ),
    select<{ document_id: string; s: string }>(
      `SELECT document_id, LEFT(summary, 1500) AS s FROM document_summary WHERE document_id IN (:ids)`,
      { ids },
    ),
  ]);
  const topics = new Map<string, string[]>();
  for (const r of topicRows) {
    if (!topics.has(r.document_id)) topics.set(r.document_id, []);
    topics.get(r.document_id)!.push(r.title);
  }
  return {
    topics,
    summaries: new Map(summaryRows.map((r) => [r.document_id, r.s])),
  };
}

export async function collectDocuments(
  start: Date,
  end: Date,
): Promise<LabelItem[]> {
  const rows = await select<{
    id: string;
    title: string;
    user_id: string;
    created_on: Date | string;
  }>(
    `SELECT id, title, user_id, created_on FROM course_document WHERE created_on >= :start AND created_on < :end`,
    { start, end },
  );
  const done = await labelledKeys(
    'document',
    rows.map((r) => r.id),
  );
  const todo = rows.filter((r) => !done.has(r.id));
  const items: LabelItem[] = [];
  for (let i = 0; i < todo.length; i += 400) {
    const chunk = todo.slice(i, i + 400);
    const { topics, summaries } = await documentFacts(chunk.map((r) => r.id));
    for (const r of chunk) {
      const list = topics.get(r.id) ?? [];
      const summary = summaries.get(r.id);
      items.push({
        kind: 'document',
        key: r.id,
        userId: r.user_id,
        documentId: r.id,
        occurredOn: toDate(r.created_on),
        content: [
          `File name: ${redact(r.title || 'untitled')}`,
          list.length
            ? `Topics the app found (${list.length}): ${list
                .slice(0, 40)
                .map((t) => shorten(redact(t), 90))
                .join('; ')}${list.length > 40 ? '; …' : ''}`
            : 'Topics the app found: none.',
          summary
            ? `Start of the app's summary: ${shorten(redact(summary), 1500)}`
            : 'Summary: none.',
        ].join('\n'),
        details: { topics: list.length },
      });
    }
  }
  return items;
}
