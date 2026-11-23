import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { generateUUID } from 'src/utils';
import { DayRange, parseRange } from '../range';
import { fullName, initialsOf, iso, isGuestEmail, select } from '../sql';
import { addDays } from '../time';
import {
  Conversation,
  TEST_TYPES,
  groupConversations,
  markAnswers,
} from './items';
import { AdminViewModel, AiLabelModel, LabelKind } from './models';

const escapeLike = (text: string) =>
  `%${text.trim().replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
const num = (v: unknown) => Number(v ?? 0) || 0;
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
const page = (p: unknown, size: unknown, def = 25) => {
  const pageSize = Math.min(100, Math.max(5, Number(size) || def));
  return { page: Math.max(1, Math.floor(Number(p)) || 1), pageSize };
};

/** A label as the admin sees it. */
export const labelDto = (l: any) =>
  l && l.status
    ? {
        id: l.id ?? l.label_id,
        status: l.status ?? l.label_status,
        mood: l.corrected_mood ?? l.correctedMood ?? l.mood ?? null,
        originalMood: l.mood ?? null,
        corrected: !!(
          l.corrected_mood ??
          l.correctedMood ??
          l.marked_wrong ??
          l.markedWrong
        ),
        markedWrong: !!(l.marked_wrong ?? l.markedWrong),
        confidence: l.confidence ?? null,
        intent: l.intent ?? null,
        outcome: l.outcome ?? null,
        issues: (parseJson(l.issues) as string[]) ?? [],
        summary: l.summary ?? null,
        quote: l.quote ?? null,
        fixIdea: l.fix_idea ?? l.fixIdea ?? null,
        details: parseJson(l.details) ?? {},
        labelledOn: iso(l.labelled_on ?? l.labelledOn),
      }
    : null;

type Person = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  email: string;
};

/** Students' conversations, tests and documents, and Claude's labels on them. */
@Injectable()
export class InsightsService {
  private conversationCache = new Map<
    string,
    { at: number; value: Promise<Conversation[]> }
  >();

  /* ---------- helpers ---------- */

  private async people(ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))];
    const rows = unique.length
      ? await select<Person>(
          `SELECT id, first_name, last_name, role, email FROM user WHERE id IN (:ids)`,
          {
            ids: unique,
          },
        )
      : [];
    const map = new Map(rows.map((r) => [r.id, r]));
    return (id: string | null) => {
      const u = id ? map.get(id) : undefined;
      const name = fullName(u?.first_name, u?.last_name, u?.role);
      return {
        userId: id,
        name,
        initials: u?.role === 'guest' ? 'G' : initialsOf(name),
        email: u && !isGuestEmail(u.email) ? u.email : null,
      };
    };
  }

  private async titles(ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))];
    const rows = unique.length
      ? await select<{ id: string; title: string; is_deleted: number }>(
          `SELECT id, title, is_deleted FROM course_document WHERE id IN (:ids)`,
          { ids: unique },
        )
      : [];
    return new Map(
      rows.map((r) => [
        r.id,
        { title: r.title, deleted: !!Number(r.is_deleted) },
      ]),
    );
  }

  private async labelsFor(kind: LabelKind, keys: string[]) {
    if (!keys.length) return new Map<string, any>();
    const rows = await select<any>(
      `SELECT * FROM ai_label WHERE kind = :kind AND item_key IN (:keys)`,
      {
        kind,
        keys,
      },
    );
    return new Map(rows.map((r) => [r.item_key, r]));
  }

  private async matchingPeople(search?: string) {
    if (!search?.trim()) return null;
    const rows = await select<{ id: string }>(
      `SELECT id FROM user WHERE CONCAT(COALESCE(first_name,''), ' ', COALESCE(last_name,'')) LIKE :q OR email LIKE :q LIMIT 2000`,
      { q: escapeLike(search) },
    );
    return new Set(rows.map((r) => r.id));
  }

  async logView(
    adminEmail: string | null | undefined,
    kind: string,
    itemKey: string,
    userId: string | null,
  ) {
    if (!adminEmail) return;
    await AdminViewModel.create({
      id: generateUUID(),
      adminEmail: adminEmail.toLowerCase(),
      kind,
      itemKey,
      userId,
      viewedOn: new Date(),
    } as AdminViewModel).catch(() => undefined);
  }

  /* ---------- Conversations ---------- */

  private conversationsIn(range: DayRange) {
    const key = `${range.from}|${range.to}`;
    const hit = this.conversationCache.get(key);
    if (hit && Date.now() - hit.at < 60_000) return hit.value;
    const value = select<any>(
      `SELECT id, user_id, course_document_id, created_on, sender, '' AS message, 0 AS has_image
       FROM document_message WHERE created_on >= :start AND created_on < :end
       ORDER BY user_id, course_document_id, created_on, id`,
      { start: range.start, end: range.end },
    ).then((rows) =>
      groupConversations(rows).filter((c) =>
        c.messages.some((m) => m.sender === 'user'),
      ),
    );
    value.catch(() => this.conversationCache.delete(key));
    if (this.conversationCache.size > 30) this.conversationCache.clear();
    this.conversationCache.set(key, { at: Date.now(), value });
    return value;
  }

  async conversations(q: {
    from?: string;
    to?: string;
    mood?: string;
    issue?: string;
    search?: string;
    userId?: string;
    documentId?: string;
    page?: unknown;
    pageSize?: unknown;
  }) {
    const range = parseRange(q.from, q.to, new Date(), 30);
    const { page: p, pageSize } = page(q.page, q.pageSize);
    let list = await this.conversationsIn(range);
    if (q.userId) list = list.filter((c) => c.userId === q.userId);
    if (q.documentId) list = list.filter((c) => c.documentId === q.documentId);
    const people = await this.matchingPeople(q.search);
    if (people) list = list.filter((c) => people.has(c.userId));
    const labels = await this.labelsFor(
      'chat',
      list.map((c) => c.key),
    );
    const moodOf = (c: Conversation) => {
      const l = labels.get(c.key);
      return l?.status === 'done' ? (l.corrected_mood ?? l.mood) : null;
    };
    const counts = {
      all: list.length,
      satisfied: 0,
      neutral: 0,
      frustrated: 0,
      unclear: 0,
      unlabelled: 0,
    };
    for (const c of list) {
      const m = moodOf(c);
      if (m && m in counts) counts[m as keyof typeof counts]++;
      else counts.unlabelled++;
    }
    if (q.mood)
      list = list.filter((c) =>
        q.mood === 'unlabelled' ? !moodOf(c) : moodOf(c) === q.mood,
      );
    if (q.issue)
      list = list.filter((c) =>
        ((parseJson(labels.get(c.key)?.issues) as string[]) ?? []).includes(
          q.issue!,
        ),
      );
    list = [...list].sort(
      (a, b) => b.startedOn.getTime() - a.startedOn.getTime(),
    );
    const total = list.length;
    const slice = list.slice((p - 1) * pageSize, p * pageSize);
    const [person, titles, previews] = await Promise.all([
      this.people(slice.map((c) => c.userId)),
      this.titles(slice.map((c) => c.documentId)),
      slice.length
        ? select<{ id: string; m: string }>(
            `SELECT id, LEFT(message, 220) AS m FROM document_message WHERE id IN (:ids)`,
            {
              ids: slice.map((c) => c.key),
            },
          )
        : Promise.resolve([]),
    ]);
    const preview = new Map(previews.map((r) => [r.id, r.m]));
    return {
      range: { from: range.from, to: range.to },
      total,
      page: p,
      pageSize,
      counts,
      items: slice.map((c) => ({
        key: c.key,
        student: person(c.userId),
        documentId: c.documentId,
        documentTitle: titles.get(c.documentId)?.title ?? 'A deleted document',
        startedOn: c.startedOn.toISOString(),
        endedOn: c.endedOn.toISOString(),
        messages: c.messages.length,
        questions: c.messages.filter((m) => m.sender === 'user').length,
        preview: preview.get(c.key) ?? '',
        label: labelDto(labels.get(c.key)),
      })),
    };
  }

  async conversation(key: string, adminEmail?: string | null) {
    const [first] = await select<any>(
      `SELECT id, user_id, course_document_id, created_on FROM document_message WHERE id = :key`,
      { key },
    );
    if (!first)
      throw new HttpException('Conversation not found', HttpStatus.NOT_FOUND);
    const rows = await select<any>(
      `SELECT id, user_id, course_document_id, created_on, sender, LEFT(message, 20000) AS message, image,
              (image IS NOT NULL AND image <> '') AS has_image, CHAR_LENGTH(message) AS length
       FROM document_message WHERE user_id = :u AND course_document_id = :d AND created_on >= :from
       ORDER BY created_on, id LIMIT 600`,
      { u: first.user_id, d: first.course_document_id, from: first.created_on },
    );
    const conv = groupConversations(rows)[0];
    if (!conv)
      throw new HttpException('Conversation not found', HttpStatus.NOT_FOUND);
    const ids = conv.messages.map((m) => m.id);
    const [person, titles, label, ratings, others] = await Promise.all([
      this.people([conv.userId]),
      this.titles([conv.documentId]),
      AiLabelModel.findOne({ where: { kind: 'chat', itemKey: key } }),
      select<{ item_id: string; rating: number; comment: string | null }>(
        `SELECT item_id, rating, comment FROM student_feedback WHERE kind = 'chat_answer' AND item_id IN (:ids)`,
        { ids },
      ),
      select<{ n: number }>(
        `SELECT COUNT(DISTINCT DATE(created_on)) AS n FROM document_message WHERE user_id = :u AND course_document_id = :d`,
        { u: conv.userId, d: conv.documentId },
      ),
    ]);
    const rated = new Map(ratings.map((r) => [r.item_id, r]));
    await this.logView(adminEmail, 'conversation', key, conv.userId);
    return {
      key,
      student: person(conv.userId),
      documentId: conv.documentId,
      documentTitle: titles.get(conv.documentId)?.title ?? 'A deleted document',
      startedOn: conv.startedOn.toISOString(),
      endedOn: conv.endedOn.toISOString(),
      daysChatted: num(others[0]?.n),
      messages: (conv.messages as any[]).map((m) => ({
        id: m.id,
        from: m.sender === 'user' ? 'student' : 'assistant',
        text: m.message,
        cut: num(m.length) > 20000,
        image: m.image || null,
        at: iso(m.created_on),
        rating: rated.get(m.id)
          ? {
              value: Number(rated.get(m.id)!.rating),
              comment: rated.get(m.id)!.comment,
            }
          : null,
      })),
      label: labelDto(label?.get({ plain: true }) ?? null),
    };
  }

  /* ---------- Tests ---------- */

  private summaryCache = new Map<
    string,
    { at: number; value: Promise<unknown> }
  >();

  /** Cached for five minutes: it reads every test in the range. */
  testsSummary(q: { from?: string; to?: string }) {
    const range = parseRange(q.from, q.to, new Date(), 30);
    const key = `${range.from}|${range.to}`;
    const hit = this.summaryCache.get(key);
    if (hit && Date.now() - hit.at < 5 * 60_000) return hit.value;
    const value = this.buildTestsSummary(range);
    value.catch(() => this.summaryCache.delete(key));
    if (this.summaryCache.size > 20) this.summaryCache.clear();
    this.summaryCache.set(key, { at: Date.now(), value });
    return value;
  }

  private async buildTestsSummary(range: DayRange) {
    const r = { start: range.start, end: range.end };
    const [byType, attempts, flagged, labels] = await Promise.all([
      select<{ t: number; made: number; started: number; finished: number }>(
        `SELECT q.question_type_id AS t, COUNT(*) AS made,
                SUM(EXISTS(SELECT 1 FROM question_progress p WHERE p.question_id = q.id)) AS started,
                SUM(EXISTS(SELECT 1 FROM score s WHERE s.question_id = q.id)) AS finished
         FROM question q WHERE q.created_on >= :start AND q.created_on < :end GROUP BY q.question_type_id`,
        r,
      ),
      select<{ status: string; answered: number; total: number; t: number }>(
        `SELECT qp.status, JSON_LENGTH(JSON_UNQUOTE(qp.data)) AS answered, JSON_LENGTH(JSON_UNQUOTE(q.data)) AS total,
                q.question_type_id AS t
         FROM question_progress qp JOIN question q ON q.id = qp.question_id
         WHERE qp.modified_on >= :start AND qp.modified_on < :end`,
        r,
      ),
      select<{
        test_id: string;
        selected_question_id: string;
        created_on: Date;
      }>(
        `SELECT f.test_id, f.selected_question_id, f.created_on FROM flagged_question f
         WHERE f.created_on >= :start AND f.created_on < :end ORDER BY f.created_on DESC LIMIT 30`,
        r,
      ),
      select<{ mood: string; issues: string; details: string }>(
        `SELECT COALESCE(corrected_mood, mood) AS mood, issues, details FROM ai_label
         WHERE kind = 'test' AND status = 'done' AND occurred_on >= :start AND occurred_on < :end`,
        r,
      ),
    ]);

    // Where unfinished attempts stop, as a share of the test (true/false counts statements, so cap at 100%).
    const stops = Array(10).fill(0);
    let stopped = 0;
    let finished = 0;
    for (const a of attempts) {
      if (a.status === 'submitted') {
        finished++;
        continue;
      }
      const total = num(a.total);
      if (!total) continue;
      stopped++;
      const share = Math.min(0.999, num(a.answered) / total);
      stops[Math.floor(share * 10)]++;
    }

    const moods: Record<string, number> = {};
    const issues: Record<string, number> = {};
    const reasons: Record<string, number> = {};
    const struggles: Record<string, number> = {};
    for (const l of labels) {
      moods[l.mood] = (moods[l.mood] ?? 0) + 1;
      for (const i of (parseJson(l.issues) as string[]) ?? [])
        issues[i] = (issues[i] ?? 0) + 1;
      const d = parseJson(l.details) ?? {};
      if (d.stopReason && d.stopReason !== 'not_applicable')
        reasons[d.stopReason] = (reasons[d.stopReason] ?? 0) + 1;
      for (const t of d.struggles ?? []) {
        const k = String(t).trim();
        if (k) struggles[k] = (struggles[k] ?? 0) + 1;
      }
    }

    // The flagged questions' text.
    const testIds = [...new Set(flagged.map((f) => f.test_id))];
    const tests = testIds.length
      ? await select<{
          id: string;
          data: string;
          user_id: string;
          course_document_id: string;
          t: number;
        }>(
          `SELECT id, data, user_id, course_document_id, question_type_id AS t FROM question WHERE id IN (:ids)`,
          { ids: testIds },
        )
      : [];
    const testMap = new Map(tests.map((t) => [t.id, t]));
    const [person, titles] = await Promise.all([
      this.people(tests.map((t) => t.user_id)),
      this.titles(tests.map((t) => t.course_document_id)),
    ]);
    const sortDesc = (o: Record<string, number>, n = 8) =>
      Object.entries(o)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([key, count]) => ({ key, count }));

    return {
      range: { from: range.from, to: range.to },
      byType: byType
        .map((t) => ({
          type: TEST_TYPES[num(t.t)] ?? 'Other',
          typeId: num(t.t),
          made: num(t.made),
          started: num(t.started),
          finished: num(t.finished),
        }))
        .sort((a, b) => b.made - a.made),
      attempts: { finished, stopped },
      /** Unfinished attempts by how far through the test they stopped: 0–10%, 10–20% … */
      stops,
      moods,
      issues: sortDesc(issues),
      stopReasons: sortDesc(reasons),
      struggles: sortDesc(struggles, 10),
      labelled: labels.length,
      // Questions students reported as wrong (skipping tests deleted since).
      flagged: flagged
        .map((f) => {
          const t = testMap.get(f.test_id);
          const questions = (parseJson(t?.data) ?? []) as any[];
          const index = questions.findIndex(
            (x) => x.id === f.selected_question_id,
          );
          return {
            testId: f.test_id,
            question:
              index >= 0 ? questions[index].question : '(question not found)',
            number: index + 1,
            topic: index >= 0 ? (questions[index].topic ?? '') : '',
            student: person(t?.user_id ?? null),
            documentTitle: titles.get(t?.course_document_id ?? '')?.title ?? '',
            at: iso(f.created_on),
          };
        })
        .filter((f) => f.number > 0),
    };
  }

  async tests(q: {
    from?: string;
    to?: string;
    type?: string;
    status?: string;
    mood?: string;
    search?: string;
    userId?: string;
    page?: unknown;
    pageSize?: unknown;
  }) {
    const range = parseRange(q.from, q.to, new Date(), 30);
    const { page: p, pageSize } = page(q.page, q.pageSize);
    const where = [`qp.modified_on >= :start`, `qp.modified_on < :end`];
    const repl: Record<string, unknown> = {
      start: range.start,
      end: range.end,
    };
    if (q.type && Number(q.type)) {
      where.push(`q.question_type_id = :type`);
      repl.type = Number(q.type);
    }
    if (q.status === 'finished') where.push(`qp.status = 'submitted'`);
    if (q.status === 'stopped') where.push(`qp.status <> 'submitted'`);
    if (q.userId) {
      where.push(`qp.user_id = :userId`);
      repl.userId = q.userId;
    }
    const people = await this.matchingPeople(q.search);
    if (people) {
      if (!people.size)
        return {
          range: { from: range.from, to: range.to },
          total: 0,
          page: p,
          pageSize,
          items: [],
        };
      where.push(`qp.user_id IN (:people)`);
      repl.people = [...people];
    }
    let join = '';
    if (q.mood) {
      join = `JOIN ai_label l ON l.kind = 'test' AND l.item_key = qp.id AND l.status = 'done'`;
      where.push(`COALESCE(l.corrected_mood, l.mood) = :mood`);
      repl.mood = q.mood;
    }
    const base = `FROM question_progress qp JOIN question q ON q.id = qp.question_id ${join} WHERE ${where.join(' AND ')}`;
    const [count, rows] = await Promise.all([
      select<{ n: number }>(`SELECT COUNT(*) AS n ${base}`, repl),
      select<any>(
        `SELECT qp.id, qp.user_id, qp.question_id, qp.status, qp.modified_on, qp.created_on,
                JSON_LENGTH(JSON_UNQUOTE(qp.data)) AS answered, JSON_LENGTH(JSON_UNQUOTE(q.data)) AS total,
                q.question_type_id AS t, q.course_document_id
         ${base} ORDER BY qp.modified_on DESC LIMIT :limit OFFSET :offset`,
        { ...repl, limit: pageSize, offset: (p - 1) * pageSize },
      ),
    ]);
    const [person, titles, labels, scores] = await Promise.all([
      this.people(rows.map((r) => r.user_id)),
      this.titles(rows.map((r) => r.course_document_id)),
      this.labelsFor(
        'test',
        rows.map((r) => r.id),
      ),
      rows.length
        ? select<{ question_id: string; user_id: string; s: number }>(
            `SELECT question_id, user_id, MAX(percentage_score) AS s FROM score WHERE question_id IN (:ids) GROUP BY question_id, user_id`,
            { ids: rows.map((r) => r.question_id) },
          )
        : Promise.resolve([]),
    ]);
    const scoreOf = new Map(
      scores.map((s) => [`${s.question_id}|${s.user_id}`, Number(s.s)]),
    );
    return {
      range: { from: range.from, to: range.to },
      total: num(count[0]?.n),
      page: p,
      pageSize,
      items: rows.map((r) => ({
        key: r.id,
        testId: r.question_id,
        type: TEST_TYPES[num(r.t)] ?? 'Test',
        student: person(r.user_id),
        documentId: r.course_document_id,
        documentTitle:
          titles.get(r.course_document_id)?.title ?? 'A deleted document',
        status: r.status === 'submitted' ? 'finished' : 'stopped',
        answered: num(r.answered),
        total: num(r.total),
        score: scoreOf.get(`${r.question_id}|${r.user_id}`) ?? null,
        at: iso(r.modified_on),
        label: labelDto(labels.get(r.id)),
      })),
    };
  }

  async test(key: string, adminEmail?: string | null) {
    const [row] = await select<any>(
      `SELECT qp.id, qp.user_id, qp.question_id, qp.status, qp.modified_on, qp.created_on, qp.data AS progress,
              q.data AS test, q.question_type_id AS t, q.course_document_id, q.created_on AS made_on, q.difficulty
       FROM question_progress qp JOIN question q ON q.id = qp.question_id WHERE qp.id = :key`,
      { key },
    );
    if (!row)
      throw new HttpException('Test attempt not found', HttpStatus.NOT_FOUND);
    const test = (parseJson(row.test) ?? []) as any[];
    const marked = markAnswers(test, (parseJson(row.progress) ?? []) as any[]);
    const answered = new Map(marked.map((m) => [m.questionId, m]));
    const [person, titles, label, scores, flags, rating] = await Promise.all([
      this.people([row.user_id]),
      this.titles([row.course_document_id]),
      AiLabelModel.findOne({ where: { kind: 'test', itemKey: key } }),
      select<{ s: number; created_on: Date }>(
        `SELECT percentage_score AS s, created_on FROM score WHERE question_id = :q AND user_id = :u ORDER BY created_on`,
        { q: row.question_id, u: row.user_id },
      ),
      select<{ selected_question_id: string }>(
        `SELECT selected_question_id FROM flagged_question WHERE test_id = :q`,
        {
          q: row.question_id,
        },
      ),
      select<{ rating: number; comment: string | null }>(
        `SELECT rating, comment FROM student_feedback WHERE kind = 'test' AND item_id = :q AND user_id = :u`,
        { q: row.question_id, u: row.user_id },
      ),
    ]);
    const flagged = new Set(flags.map((f) => f.selected_question_id));
    await this.logView(adminEmail, 'test', key, row.user_id);
    return {
      key,
      testId: row.question_id,
      type: TEST_TYPES[num(row.t)] ?? 'Test',
      difficulty: row.difficulty || null,
      student: person(row.user_id),
      documentId: row.course_document_id,
      documentTitle:
        titles.get(row.course_document_id)?.title ?? 'A deleted document',
      madeOn: iso(row.made_on),
      lastAnswerOn: iso(row.modified_on),
      status: row.status === 'submitted' ? 'finished' : 'stopped',
      scores: scores.map((s) => ({
        score: Number(s.s),
        at: iso(s.created_on),
      })),
      rating: rating[0]
        ? { value: Number(rating[0].rating), comment: rating[0].comment }
        : null,
      questions: test.map((q, i) => {
        const a = answered.get(q.id);
        return {
          number: i + 1,
          question: q.question,
          topic: q.topic ?? '',
          answered: !!a,
          chosen: a?.chosen ?? null,
          correct:
            a?.correct ??
            ((q.options ?? []).find((o: any) => o.id === q.correctAnswerId)
              ?.value ||
              null),
          right: a ? a.right : null,
          flagged: flagged.has(q.id),
          explanation: q.explanation ?? null,
        };
      }),
      label: labelDto(label?.get({ plain: true }) ?? null),
    };
  }

  /* ---------- Documents ---------- */

  async documents(q: {
    from?: string;
    to?: string;
    search?: string;
    field?: string;
    kind?: string;
    fileType?: string;
    userId?: string;
    page?: unknown;
    pageSize?: unknown;
  }) {
    const range = parseRange(q.from, q.to, new Date(), 30);
    const { page: p, pageSize } = page(q.page, q.pageSize, 24);
    const where = [`d.created_on >= :start`, `d.created_on < :end`];
    const repl: Record<string, unknown> = {
      start: range.start,
      end: range.end,
    };
    if (q.search?.trim()) {
      where.push(`d.title LIKE :q`);
      repl.q = escapeLike(q.search);
    }
    if (q.userId) {
      where.push(`d.user_id = :userId`);
      repl.userId = q.userId;
    }
    if (q.fileType) {
      where.push(`LOWER(SUBSTRING_INDEX(d.title, '.', -1)) = :ext`);
      repl.ext = q.fileType.toLowerCase();
    }
    if (q.field) {
      where.push(`JSON_UNQUOTE(JSON_EXTRACT(l.details, '$.field')) = :field`);
      repl.field = q.field;
    }
    if (q.kind) {
      where.push(`JSON_UNQUOTE(JSON_EXTRACT(l.details, '$.kind')) = :dkind`);
      repl.dkind = q.kind;
    }
    const base = `FROM course_document d LEFT JOIN ai_label l ON l.kind = 'document' AND l.item_key = d.id AND l.status = 'done'
                  WHERE ${where.join(' AND ')}`;
    const rangeOnly = `FROM course_document d LEFT JOIN ai_label l ON l.kind = 'document' AND l.item_key = d.id AND l.status = 'done'
                       WHERE d.created_on >= :start AND d.created_on < :end`;
    const [count, rows, fields, kinds, exts] = await Promise.all([
      select<{ n: number }>(`SELECT COUNT(*) AS n ${base}`, repl),
      select<any>(
        `SELECT d.id, d.title, d.user_id, d.created_on, d.is_deleted, l.id AS label_id ${base}
         ORDER BY d.created_on DESC LIMIT :limit OFFSET :offset`,
        { ...repl, limit: pageSize, offset: (p - 1) * pageSize },
      ),
      select<{ k: string; n: number }>(
        `SELECT JSON_UNQUOTE(JSON_EXTRACT(l.details, '$.field')) AS k, COUNT(*) AS n ${rangeOnly} AND l.id IS NOT NULL GROUP BY k`,
        repl,
      ),
      select<{ k: string; n: number }>(
        `SELECT JSON_UNQUOTE(JSON_EXTRACT(l.details, '$.kind')) AS k, COUNT(*) AS n ${rangeOnly} AND l.id IS NOT NULL GROUP BY k`,
        repl,
      ),
      select<{ k: string; n: number }>(
        `SELECT LOWER(SUBSTRING_INDEX(d.title, '.', -1)) AS k, COUNT(*) AS n ${rangeOnly}
         AND d.title LIKE '%.%' AND CHAR_LENGTH(SUBSTRING_INDEX(d.title, '.', -1)) <= 5 GROUP BY k ORDER BY n DESC LIMIT 8`,
        repl,
      ),
    ]);
    const ids = rows.map((r) => r.id);
    const [person, labels, usage] = await Promise.all([
      this.people(rows.map((r) => r.user_id)),
      this.labelsFor('document', ids),
      this.documentUsage(ids),
    ]);
    const facet = (list: { k: string; n: number }[]) =>
      list
        .filter((r) => r.k)
        .map((r) => ({ key: r.k, count: num(r.n) }))
        .sort((a, b) => b.count - a.count);
    return {
      range: { from: range.from, to: range.to },
      total: num(count[0]?.n),
      page: p,
      pageSize,
      facets: {
        fields: facet(fields),
        kinds: facet(kinds),
        fileTypes: facet(exts),
      },
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        fileType: /\.[a-z0-9]{1,5}$/i.test(r.title ?? '')
          ? r.title.split('.').pop().toLowerCase()
          : null,
        owner: person(r.user_id),
        uploadedOn: iso(r.created_on),
        deleted: !!Number(r.is_deleted),
        usage: usage.get(r.id) ?? {
          tests: 0,
          chats: 0,
          readingSeconds: 0,
          topics: 0,
          hasSummary: false,
        },
        label: labelDto(labels.get(r.id)),
      })),
    };
  }

  private async documentUsage(ids: string[]) {
    const map = new Map<
      string,
      {
        tests: number;
        chats: number;
        readingSeconds: number;
        topics: number;
        hasSummary: boolean;
      }
    >();
    if (!ids.length) return map;
    const [tests, chats, reading, topics, summaries] = await Promise.all([
      select<{ id: string; n: number }>(
        `SELECT course_document_id AS id, COUNT(*) AS n FROM question WHERE course_document_id IN (:ids) GROUP BY id`,
        { ids },
      ),
      select<{ id: string; n: number }>(
        `SELECT course_document_id AS id, SUM(sender = 'user') AS n FROM document_message WHERE course_document_id IN (:ids) GROUP BY id`,
        { ids },
      ),
      select<{ id: string; s: number }>(
        `SELECT document_id AS id, SUM(seconds) AS s FROM easy_read_reading WHERE document_id IN (:ids) GROUP BY id`,
        { ids },
      ),
      select<{ id: string; n: number }>(
        `SELECT document_id AS id, COUNT(*) AS n FROM document_topic WHERE document_id IN (:ids) GROUP BY id`,
        { ids },
      ),
      select<{ id: string }>(
        `SELECT DISTINCT document_id AS id FROM document_summary WHERE document_id IN (:ids)`,
        {
          ids,
        },
      ),
    ]);
    for (const id of ids)
      map.set(id, {
        tests: 0,
        chats: 0,
        readingSeconds: 0,
        topics: 0,
        hasSummary: false,
      });
    for (const r of tests) map.get(r.id)!.tests = num(r.n);
    for (const r of chats) map.get(r.id)!.chats = num(r.n);
    for (const r of reading) map.get(r.id)!.readingSeconds = num(r.s);
    for (const r of topics) map.get(r.id)!.topics = num(r.n);
    for (const r of summaries) map.get(r.id)!.hasSummary = true;
    return map;
  }

  async document(id: string, adminEmail?: string | null) {
    const [doc] = await select<any>(
      `SELECT id, title, user_id, created_on, is_deleted FROM course_document WHERE id = :id`,
      { id },
    );
    if (!doc)
      throw new HttpException('Document not found', HttpStatus.NOT_FOUND);
    const [
      person,
      file,
      topics,
      summary,
      label,
      tests,
      chats,
      reading,
      pages,
      usage,
    ] = await Promise.all([
      this.people([doc.user_id]),
      select<{ original_file_id: string; current_file_format: string }>(
        `SELECT original_file_id, current_file_format FROM stored_files WHERE document_id = :id LIMIT 1`,
        { id },
      ),
      select<{
        title: string;
        short_description: string;
        startPage: number;
        endPage: number;
      }>(
        `SELECT title, short_description, startPage, endPage FROM document_topic WHERE document_id = :id ORDER BY startPage, id LIMIT 200`,
        { id },
      ),
      select<{ summary: string }>(
        `SELECT LEFT(summary, 30000) AS summary FROM document_summary WHERE document_id = :id LIMIT 1`,
        {
          id,
        },
      ),
      AiLabelModel.findOne({ where: { kind: 'document', itemKey: id } }),
      select<any>(
        `SELECT q.id, q.question_type_id AS t, q.created_on, q.user_id, JSON_LENGTH(JSON_UNQUOTE(q.data)) AS total,
                (SELECT MAX(percentage_score) FROM score s WHERE s.question_id = q.id) AS best,
                (SELECT qp.id FROM question_progress qp WHERE qp.question_id = q.id ORDER BY qp.modified_on DESC LIMIT 1) AS attempt
         FROM question q WHERE q.course_document_id = :id ORDER BY q.created_on DESC LIMIT 50`,
        { id },
      ),
      select<{ n: number; days: number; first_id: string }>(
        `SELECT SUM(sender = 'user') AS n, COUNT(DISTINCT DATE(created_on)) AS days, MIN(id) AS first_id
         FROM document_message WHERE course_document_id = :id`,
        { id },
      ),
      select<{ s: number; readers: number; sessions: number; last_at: Date }>(
        `SELECT SUM(seconds) AS s, COUNT(DISTINCT user_id) AS readers, SUM(sessions) AS sessions, MAX(last_at) AS last_at
         FROM easy_read_reading WHERE document_id = :id`,
        { id },
      ),
      select<{ status: string; n: number }>(
        `SELECT status, COUNT(*) AS n FROM simplified_page WHERE document_id = :id GROUP BY status`,
        { id },
      ),
      this.documentUsage([id]),
    ]);
    await this.logView(adminEmail, 'document', id, doc.user_id);
    const fileId = file[0]?.original_file_id ?? null;
    const pageCount = pages.reduce((a, r) => a + num(r.n), 0);
    return {
      id,
      title: doc.title,
      owner: person(doc.user_id),
      uploadedOn: iso(doc.created_on),
      deleted: !!Number(doc.is_deleted),
      file: fileId
        ? {
            previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
            thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`,
            openUrl: `https://drive.google.com/file/d/${fileId}/view`,
            format: file[0].current_file_format,
          }
        : null,
      topics: topics.map((t) => ({
        title: t.title,
        description: t.short_description,
        pages:
          t.startPage && t.endPage
            ? t.startPage === t.endPage
              ? `${t.startPage}`
              : `${t.startPage}–${t.endPage}`
            : null,
      })),
      summary: summary[0]?.summary ?? null,
      label: labelDto(label?.get({ plain: true }) ?? null),
      usage: usage.get(id),
      tests: tests.map((t) => ({
        testId: t.id,
        attempt: t.attempt,
        type: TEST_TYPES[num(t.t)] ?? 'Test',
        madeOn: iso(t.created_on),
        questions: num(t.total),
        best: t.best === null ? null : Number(t.best),
      })),
      chat: { questions: num(chats[0]?.n), days: num(chats[0]?.days) },
      easyRead: {
        seconds: num(reading[0]?.s),
        readers: num(reading[0]?.readers),
        sessions: num(reading[0]?.sessions),
        lastReadAt: iso(reading[0]?.last_at),
        pagesSimplified: num(pages.find((r) => r.status === 'done')?.n),
        pages: pageCount,
      },
    };
  }

  /* ---------- Insights ---------- */

  async overview(q: { from?: string; to?: string }) {
    const range = parseRange(q.from, q.to, new Date(), 30);
    const r = { start: range.start, end: range.end };
    const weeks = Math.max(1, Math.ceil(range.days / 7));
    const [labels, feedback, corrections, pending] = await Promise.all([
      select<any>(
        `SELECT kind, COALESCE(corrected_mood, mood) AS mood, confidence, intent, outcome, issues, details,
                FLOOR(TIMESTAMPDIFF(SECOND, :start, occurred_on) / 604800) AS w
         FROM ai_label WHERE status = 'done' AND occurred_on >= :start AND occurred_on < :end`,
        r,
      ),
      select<{ kind: string; rating: number; n: number }>(
        `SELECT kind, rating, COUNT(*) AS n FROM student_feedback WHERE created_on >= :start AND created_on < :end GROUP BY kind, rating`,
        r,
      ),
      select<{ reviewed: number; wrong: number }>(
        `SELECT COUNT(*) AS reviewed, SUM(marked_wrong = 1 OR (corrected_mood IS NOT NULL AND corrected_mood <> mood)) AS wrong
         FROM ai_label WHERE corrected_on IS NOT NULL`,
      ),
      select<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ai_label WHERE status = 'pending'`,
      ),
    ]);
    const blank = () => ({
      labelled: 0,
      moods: { satisfied: 0, neutral: 0, frustrated: 0, unclear: 0 } as Record<
        string,
        number
      >,
      weeks: Array.from(
        { length: weeks },
        () =>
          ({ satisfied: 0, neutral: 0, frustrated: 0, unclear: 0 }) as Record<
            string,
            number
          >,
      ),
      issues: {} as Record<string, number>,
      intents: {} as Record<string, number>,
      outcomes: {} as Record<string, number>,
    });
    const chat = blank();
    const test = blank();
    const docs = {
      labelled: 0,
      fields: {} as Record<string, number>,
      kinds: {} as Record<string, number>,
      levels: {} as Record<string, number>,
      subjects: {} as Record<string, number>,
      quality: {} as Record<string, number>,
    };
    const bump = (o: Record<string, number>, k: string | null | undefined) => {
      if (k) o[k] = (o[k] ?? 0) + 1;
    };
    for (const l of labels) {
      if (l.kind === 'document') {
        const d = parseJson(l.details) ?? {};
        docs.labelled++;
        bump(docs.fields, d.field);
        bump(docs.kinds, d.kind);
        bump(docs.levels, d.level);
        bump(docs.quality, d.quality);
        const subject = String(d.subject ?? '').trim();
        if (subject && !/^(unknown|unclear|n\/a|none)$/i.test(subject))
          bump(docs.subjects, subject);
        continue;
      }
      const target = l.kind === 'chat' ? chat : test;
      target.labelled++;
      bump(target.moods, l.mood);
      const w = Math.min(weeks - 1, Math.max(0, num(l.w)));
      if (l.mood) target.weeks[w][l.mood] = (target.weeks[w][l.mood] ?? 0) + 1;
      for (const i of (parseJson(l.issues) as string[]) ?? [])
        bump(target.issues, i);
      bump(target.intents, l.intent);
      bump(target.outcomes, l.outcome);
    }
    const top = (o: Record<string, number>, n = 8) =>
      Object.entries(o)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([key, count]) => ({ key, count }));
    const shape = (t: ReturnType<typeof blank>) => ({
      labelled: t.labelled,
      moods: t.moods,
      weeks: t.weeks.map((w, i) => ({
        start: addDays(range.from, i * 7),
        ...w,
      })),
      issues: top(t.issues),
      intents: top(t.intents),
      outcomes: top(t.outcomes),
    });
    const fb = (kind: string) => ({
      up: num(feedback.find((f) => f.kind === kind && Number(f.rating) > 0)?.n),
      down: num(
        feedback.find((f) => f.kind === kind && Number(f.rating) < 0)?.n,
      ),
    });
    return {
      range: { from: range.from, to: range.to, days: range.days },
      chat: shape(chat),
      test: shape(test),
      documents: {
        labelled: docs.labelled,
        fields: top(docs.fields, 15),
        kinds: top(docs.kinds),
        levels: top(docs.levels),
        quality: top(docs.quality),
        subjects: top(docs.subjects, 12),
      },
      feedback: {
        chat: fb('chat_answer'),
        test: fb('test'),
        easyRead: fb('easy_read'),
      },
      accuracy: {
        reviewed: num(corrections[0]?.reviewed),
        wrong: num(corrections[0]?.wrong),
      },
      pending: num(pending[0]?.n),
    };
  }

  async labels(q: {
    kind?: string;
    mood?: string;
    issue?: string;
    field?: string;
    from?: string;
    to?: string;
    userId?: string;
    page?: unknown;
    pageSize?: unknown;
  }) {
    const range = parseRange(q.from, q.to, new Date(), 30);
    const { page: p, pageSize } = page(q.page, q.pageSize, 20);
    const where = [
      `status = 'done'`,
      `occurred_on >= :start`,
      `occurred_on < :end`,
    ];
    const repl: Record<string, unknown> = {
      start: range.start,
      end: range.end,
    };
    if (q.kind) {
      where.push(`kind = :kind`);
      repl.kind = q.kind;
    }
    if (q.mood) {
      where.push(`COALESCE(corrected_mood, mood) = :mood`);
      repl.mood = q.mood;
    }
    if (q.issue) {
      where.push(`JSON_CONTAINS(issues, JSON_QUOTE(:issue))`);
      repl.issue = q.issue;
    }
    if (q.field) {
      where.push(`JSON_UNQUOTE(JSON_EXTRACT(details, '$.field')) = :field`);
      repl.field = q.field;
    }
    if (q.userId) {
      where.push(`user_id = :userId`);
      repl.userId = q.userId;
    }
    const [count, rows] = await Promise.all([
      select<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ai_label WHERE ${where.join(' AND ')}`,
        repl,
      ),
      select<any>(
        `SELECT * FROM ai_label WHERE ${where.join(' AND ')} ORDER BY occurred_on DESC LIMIT :limit OFFSET :offset`,
        { ...repl, limit: pageSize, offset: (p - 1) * pageSize },
      ),
    ]);
    const [person, titles] = await Promise.all([
      this.people(rows.map((r) => r.user_id)),
      this.titles(rows.map((r) => r.document_id)),
    ]);
    return {
      total: num(count[0]?.n),
      page: p,
      pageSize,
      items: rows.map((r) => ({
        kind: r.kind,
        key: r.item_key,
        occurredOn: iso(r.occurred_on),
        student: person(r.user_id),
        documentId: r.document_id,
        documentTitle: titles.get(r.document_id)?.title ?? null,
        label: labelDto(r),
      })),
    };
  }

  async correct(
    id: string,
    body: { mood?: unknown; wrong?: unknown },
    adminEmail?: string | null,
  ) {
    const label = await AiLabelModel.findByPk(id);
    if (!label)
      throw new HttpException('Label not found', HttpStatus.NOT_FOUND);
    const moods = ['satisfied', 'neutral', 'frustrated', 'unclear'];
    const mood =
      typeof body?.mood === 'string' && moods.includes(body.mood)
        ? body.mood
        : null;
    const wrong = body?.wrong === true;
    await label.update({
      correctedMood: mood && mood !== label.mood ? mood : null,
      markedWrong: wrong || (mood !== null && mood !== label.mood),
      correctedBy: adminEmail ?? null,
      correctedOn: new Date(),
    });
    return labelDto(label.get({ plain: true }));
  }

  async views(limit = 100) {
    const rows = await select<any>(
      `SELECT admin_email, kind, item_key, user_id, viewed_on FROM admin_view ORDER BY viewed_on DESC LIMIT :limit`,
      { limit },
    );
    const person = await this.people(rows.map((r) => r.user_id));
    return rows.map((r) => ({
      admin: r.admin_email,
      kind: r.kind,
      key: r.item_key,
      student: person(r.user_id),
      at: iso(r.viewed_on),
    }));
  }
}
