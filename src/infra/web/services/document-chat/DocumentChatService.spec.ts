import { NotFoundException } from '@nestjs/common';
import { StreamTextResult } from 'src/integrations/vercel-ai/services/ClaudeConn';
import { DocumentChatService, REFUSAL_NOTICE } from './DocumentChatService';

type Saved = { sender: string; message: string; image?: string; at: number };

const setup = ({
  pages = [] as { pageNumber: number; sourceText: string }[],
  history = [] as { sender: string; message: string }[],
  hits = ['Mitochondria make ATP.'],
  stream = async (args: any): Promise<StreamTextResult> => {
    args.onThinking?.();
    args.onText('Hello ');
    args.onText('world');
    return {
      text: 'Hello world',
      stopReason: 'end_turn',
      aborted: false,
      model: 'claude-sonnet-5-5',
      usage: { input_tokens: 10, output_tokens: 2 } as any,
    };
  },
  ownsDocument = true,
} = {}) => {
  const saved: Saved[] = [];
  const order: string[] = [];
  const document = {
    id: 'doc-1',
    title: 'Cell Biology',
    openAiFileId: 'not yet set',
  };
  const deps = {
    courseDocuments: {
      findCourseDocumentById: jest.fn(async () =>
        ownsDocument ? document : null,
      ),
    },
    messages: { findRecentMessages: jest.fn(async () => history) },
    summaries: {
      findByDocumentId: jest.fn(async () => ({ summary: 'About cells.' })),
    },
    pages: { findPageTexts: jest.fn(async () => pages) },
    repository: {
      create: jest.fn(async (m: any) => {
        order.push(`save:${m.sender}`);
        saved.push({
          sender: m.sender,
          message: m.message,
          image: m.image,
          at: Date.now(),
        });
        return { id: `id-${saved.length}` };
      }),
    },
    pinecone: { searchPassages: jest.fn(async () => hits) },
    claude: {
      streamText: jest.fn(async (args: any) => {
        order.push('stream');
        return stream(args);
      }),
    },
  };
  const service = new DocumentChatService(
    deps.courseDocuments as any,
    deps.messages as any,
    deps.summaries as any,
    deps.pages as any,
    deps.repository as any,
    deps.pinecone as any,
    deps.claude as any,
  );
  (service as any).minGapAfterQuestionMs = 0;
  const sink = { meta: jest.fn(), thinking: jest.fn(), text: jest.fn() };
  return { service, deps, saved, order, sink, document };
};

const lastCall = (mock: jest.Mock) =>
  mock.mock.calls[mock.mock.calls.length - 1][0];

describe('DocumentChatService', () => {
  it("returns 404 for someone else's document", async () => {
    const { service } = setup({ ownsDocument: false });
    await expect(
      service.findDocument('doc-1', 'user-2'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.findDocument('', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('saves the question first, streams the reply and saves it', async () => {
    const { service, deps, saved, order, sink, document } = setup({
      history: [
        { sender: 'user', message: 'Earlier question' },
        {
          sender: 'system',
          message: 'Earlier answer **source text start** x **source text end**',
        },
      ],
    });
    const outcome = await service.reply({
      document: document as any,
      userId: 'user-1',
      request: { message: 'What makes ATP in a cell?' },
      sink,
    });

    expect(order).toEqual(['save:user', 'stream', 'save:system']);
    expect(saved.map((m) => [m.sender, m.message])).toEqual([
      ['user', 'What makes ATP in a cell?'],
      ['system', 'Hello world'],
    ]);
    expect(outcome).toEqual({
      status: 'done',
      text: 'Hello world',
      messageId: 'id-2',
    });

    expect(sink.meta).toHaveBeenCalledWith({ mode: 'passages', pages: [] });
    expect(sink.thinking).toHaveBeenCalledTimes(1);
    expect(sink.text.mock.calls.map((c) => c[0])).toEqual(['Hello ', 'world']);

    expect(deps.pinecone.searchPassages).toHaveBeenCalledWith(
      'What makes ATP in a cell?',
      'doc-1',
      8,
    );
    const args = lastCall(deps.claude.streamText);
    expect(args.effort).toBe('low');
    expect(args.system).toContain('Cell Biology');
    expect(args.system).toContain('About cells.');
    expect(args.messages).toHaveLength(3);
    expect(args.messages[0]).toEqual({
      role: 'user',
      content: 'Earlier question',
    });
    expect(args.messages[1]).toEqual({
      role: 'assistant',
      content: 'Earlier answer',
    });
    expect(args.messages[2].role).toBe('user');
    expect(args.messages[2].content).toContain(
      '<passage>\nMitochondria make ATP.',
    );
    expect(args.messages[2].content).toContain('What makes ATP in a cell?');
  });

  it('sends a small PDF whole, with page numbers, and skips the search', async () => {
    const { service, deps, sink, document } = setup({
      pages: [
        { pageNumber: 1, sourceText: 'Cells are small.' },
        { pageNumber: 2, sourceText: 'Mitochondria make ATP.' },
      ],
    });
    await service.reply({
      document: document as any,
      userId: 'user-1',
      request: { message: 'What makes ATP?' },
      sink,
    });
    expect(deps.pinecone.searchPassages).not.toHaveBeenCalled();
    expect(sink.meta).toHaveBeenCalledWith({ mode: 'document', pages: [] });
    const args = lastCall(deps.claude.streamText);
    expect(args.cacheSystem).toBe(true);
    expect(args.system).toContain(
      '<page number="2">\nMitochondria make ATP.\n</page>',
    );
    expect(args.system).toContain('[p. 4]');
    expect(args.messages[0].content).toBe("Student's message: What makes ATP?");
  });

  it('labels passages with their page and reports the pages read', async () => {
    const pages = Array.from({ length: 30 }, (_, i) => ({
      pageNumber: i + 1,
      sourceText: `Page ${i + 1} ` + 'x'.repeat(6000),
    }));
    const { service, sink, document, deps } = setup({
      pages,
      hits: [pages[11].sourceText, pages[2].sourceText],
    });
    await service.reply({
      document: document as any,
      userId: 'user-1',
      request: { message: 'Tell me about the main idea of chapter two' },
      sink,
    });
    expect(sink.meta).toHaveBeenCalledWith({
      mode: 'passages',
      pages: [3, 12],
    });
    expect(lastCall(deps.claude.streamText).messages[0].content).toContain(
      '<passage page="3">',
    );
  });

  it("doesn't save a retried question twice", async () => {
    const { service, deps, saved, sink, document } = setup({
      history: [
        { sender: 'user', message: 'Q1' },
        { sender: 'system', message: 'A1' },
        { sender: 'user', message: 'What is osmosis?' },
      ],
    });
    await service.reply({
      document: document as any,
      userId: 'user-1',
      request: { message: 'What is osmosis?' },
      retry: true,
      sink,
    });
    expect(saved.map((m) => m.sender)).toEqual(['system']);
    const { messages } = lastCall(deps.claude.streamText);
    expect(messages.map((m: any) => m.role)).toEqual([
      'user',
      'assistant',
      'user',
    ]);
  });

  it('saves the question on a retry when the first attempt never did', async () => {
    const { service, saved, sink, document } = setup({
      history: [{ sender: 'user', message: 'Something else' }],
    });
    await service.reply({
      document: document as any,
      userId: 'user-1',
      request: { message: 'What is osmosis?' },
      retry: true,
      sink,
    });
    expect(saved.map((m) => m.sender)).toEqual(['user', 'system']);
  });

  it('keeps what was written when the student stops the reply', async () => {
    const { service, saved, sink, document } = setup({
      stream: async (args) => {
        args.onText('Partial');
        return { text: 'Partial', stopReason: null, aborted: true };
      },
    });
    const outcome = await service.reply({
      document: document as any,
      userId: 'user-1',
      request: { message: 'Explain osmosis' },
      sink,
    });
    expect(outcome.status).toBe('stopped');
    expect(saved.map((m) => [m.sender, m.message])).toEqual([
      ['user', 'Explain osmosis'],
      ['system', 'Partial'],
    ]);
  });

  it('saves nothing for a reply stopped before it started', async () => {
    const { service, saved, sink, document } = setup({
      stream: async () => ({ text: '', stopReason: null, aborted: true }),
    });
    const outcome = await service.reply({
      document: document as any,
      userId: 'user-1',
      request: { message: 'Explain osmosis' },
      sink,
    });
    expect(outcome).toEqual({ status: 'stopped', text: '' });
    expect(saved.map((m) => m.sender)).toEqual(['user']);
  });

  it('replaces a refused reply with a notice', async () => {
    const { service, saved, sink, document } = setup({
      stream: async (args) => {
        args.onText('Half an ans');
        return { text: 'Half an ans', stopReason: 'refusal', aborted: false };
      },
    });
    const outcome = await service.reply({
      document: document as any,
      userId: 'user-1',
      request: { message: 'Something' },
      sink,
    });
    expect(outcome.status).toBe('refused');
    expect(outcome.text).toBe(REFUSAL_NOTICE);
    expect(saved[1].message).toBe(REFUSAL_NOTICE);
  });

  it('marks a reply cut off by the length limit', async () => {
    const { service, sink, document } = setup({
      stream: async () => ({
        text: 'Long',
        stopReason: 'max_tokens',
        aborted: false,
      }),
    });
    const outcome = await service.reply({
      document: document as any,
      userId: 'user-1',
      request: { message: 'Something' },
      sink,
    });
    expect(outcome.status).toBe('truncated');
  });

  it('keeps the question but saves no reply when Claude fails', async () => {
    const { service, saved, sink, document } = setup({
      stream: async () => {
        throw new Error('overloaded');
      },
    });
    await expect(
      service.reply({
        document: document as any,
        userId: 'user-1',
        request: { message: 'Something' },
        sink,
      }),
    ).rejects.toThrow('overloaded');
    expect(saved.map((m) => m.sender)).toEqual(['user']);
  });

  it('opens the conversation with the student', async () => {
    const { service, deps, sink, document } = setup({
      history: [
        { sender: 'system', message: 'Older answer' },
        { sender: 'user', message: 'Q' },
        { sender: 'system', message: 'A' },
      ],
    });
    await service.reply({
      document: document as any,
      userId: 'user-1',
      request: { message: 'And then?' },
      sink,
    });
    const { messages } = lastCall(deps.claude.streamText);
    expect(messages[0]).toEqual({ role: 'user', content: 'Q' });
  });

  it('asks about an image in one call, with the image attached', async () => {
    const { service, deps, saved, sink, document } = setup();
    await service.reply({
      document: document as any,
      userId: 'user-1',
      request: {
        message: 'krebs cycle diagram',
        imageUrl: 'https://img.example/k.png',
      },
      sink,
    });
    expect(deps.claude.streamText).toHaveBeenCalledTimes(1);
    const content = lastCall(deps.claude.streamText).messages[0].content;
    expect(content[0]).toEqual({
      type: 'image',
      source: { type: 'url', url: 'https://img.example/k.png' },
    });
    expect(content[1].text).toContain('"krebs cycle diagram"');
    expect(saved[0]).toMatchObject({
      sender: 'user',
      message: 'Tell me more about this image',
      image: 'https://img.example/k.png',
    });
  });

  it('runs highlights with their own task and search', async () => {
    const { service, deps, sink, document } = setup();
    await service.reply({
      document: document as any,
      userId: 'user-1',
      request: {
        message: 'define - osmotic pressure',
        highlight: { highlight: 'define', question: 'osmotic pressure' },
      },
      sink,
    });
    expect((deps.pinecone.searchPassages.mock.calls as any)[0][0]).toBe(
      'osmotic pressure',
    );
    const content = lastCall(deps.claude.streamText).messages[0].content;
    expect(content).toContain(
      '<highlighted_text>osmotic pressure</highlighted_text>',
    );
    expect(content).not.toContain("Student's message");
  });

  it('thinks harder about practice questions', async () => {
    const { service, deps, sink, document } = setup();
    await service.reply({
      document: document as any,
      userId: 'user-1',
      request: {
        message: 'Which organelle makes ATP?',
        notSureQuestion: {
          question: 'Which organelle makes ATP?',
          options: ['Nucleus', 'Mitochondrion'],
          questionType: 'Multiple Choice',
        },
      },
      sink,
    });
    expect(lastCall(deps.claude.streamText).effort).toBe('medium');
  });

  it('leaves a second between the question and a fast reply (created_on has seconds)', async () => {
    const { service, saved, sink, document } = setup();
    (service as any).minGapAfterQuestionMs = 150;
    await service.reply({
      document: document as any,
      userId: 'user-1',
      request: { message: 'Quick one' },
      sink,
    });
    expect(saved[1].at - saved[0].at).toBeGreaterThanOrEqual(140);
  });

  it('keeps page text in memory only up to a budget', async () => {
    const { service, deps } = setup();
    const big = 'x'.repeat(1_900_000);
    deps.pages.findPageTexts.mockImplementation(async () => [
      { pageNumber: 1, sourceText: big },
    ]);
    const getPages = (id: string) => (service as any).getPages(id);
    for (const id of ['a', 'b', 'c', 'd', 'e']) await getPages(id);
    expect((service as any).pageCacheChars).toBeLessThanOrEqual(8_000_000);
    expect(deps.pages.findPageTexts).toHaveBeenCalledTimes(5);
    await getPages('e'); // still cached
    expect(deps.pages.findPageTexts).toHaveBeenCalledTimes(5);
    await getPages('a'); // the oldest was let go
    expect(deps.pages.findPageTexts).toHaveBeenCalledTimes(6);
  });

  it("doesn't cache one document bigger than a quarter of the budget", async () => {
    const { service, deps } = setup();
    deps.pages.findPageTexts.mockImplementation(async () => [
      { pageNumber: 1, sourceText: 'y'.repeat(2_100_000) },
    ]);
    await (service as any).getPages('huge');
    expect((service as any).pageCacheChars).toBe(0);
  });

  it('reads page text once for several questions', async () => {
    const { service, deps, sink, document } = setup();
    for (const message of ['One question here', 'Another question here']) {
      await service.reply({
        document: document as any,
        userId: 'user-1',
        request: { message },
        sink,
      });
    }
    expect(deps.pages.findPageTexts).toHaveBeenCalledTimes(1);
  });
});
