import {
  MAX_RELIABLE_PAGES,
  WHOLE_DOCUMENT_MAX_CHARS,
  buildSearchQuery,
  chatRequestProblem,
  buildSystemPrompt,
  buildTask,
  buildUserTurn,
  citedPageNumbers,
  effortFor,
  historyToTurns,
  isFollowUp,
  pagesAreReliable,
  parseChatRequest,
  passagesFromHits,
  shouldSendWholeDocument,
  sseEvent,
  stripSourceText,
} from './chatPrompt';

const pages = (n: number, text = (i: number) => `Page ${i} text`) =>
  Array.from({ length: n }, (_, i) => ({
    pageNumber: i + 1,
    text: text(i + 1),
  }));

describe('stripSourceText', () => {
  it('removes passages saved with old replies', () => {
    const saved = `The answer.\n\n**source text start**\nlots of pages\n**source text end**\n`;
    expect(stripSourceText(saved)).toBe('The answer.');
  });

  it('leaves normal replies alone', () => {
    expect(stripSourceText('  Just an answer  ')).toBe('Just an answer');
  });

  it('drops everything after an unterminated marker', () => {
    expect(stripSourceText('Answer **source text start** never ends')).toBe(
      'Answer',
    );
  });
});

describe('whole document or passages', () => {
  it('sends small PDFs whole', () => {
    expect(shouldSendWholeDocument(pages(10))).toBe(true);
  });

  it('searches large documents', () => {
    const big = pages(20, () => 'x'.repeat(WHOLE_DOCUMENT_MAX_CHARS / 10));
    expect(shouldSendWholeDocument(big)).toBe(false);
  });

  it('searches documents without page text', () => {
    expect(shouldSendWholeDocument([])).toBe(false);
    expect(shouldSendWholeDocument(pages(3, () => '  '))).toBe(false);
  });

  it("doesn't trust page numbers once text extraction merged pages", () => {
    expect(pagesAreReliable(pages(MAX_RELIABLE_PAGES - 1))).toBe(true);
    expect(pagesAreReliable(pages(MAX_RELIABLE_PAGES))).toBe(false);
    expect(shouldSendWholeDocument(pages(MAX_RELIABLE_PAGES, () => 'a'))).toBe(
      false,
    );
  });
});

describe('buildSystemPrompt', () => {
  it('includes the whole document with page numbers and asks for citations', () => {
    const prompt = buildSystemPrompt({
      title: 'Cell Biology',
      summary: 'About cells.',
      pages: [
        { pageNumber: 1, text: 'Mitochondria make ATP.' },
        { pageNumber: 2, text: '   ' },
        { pageNumber: 3, text: 'Ribosomes make proteins.' },
      ],
      wholeDocument: true,
      citePages: true,
    });
    expect(prompt).toContain('"Cell Biology"');
    expect(prompt).toContain(
      '<document_summary>\nAbout cells.\n</document_summary>',
    );
    expect(prompt).toContain(
      '<page number="1">\nMitochondria make ATP.\n</page>',
    );
    expect(prompt).toContain('<page number="3">');
    expect(prompt).not.toContain('<page number="2">');
    expect(prompt).toContain('[p. 4]');
  });

  it('is the same for every question about a document (so it can be cached)', () => {
    const args = {
      title: 'T',
      summary: 'S',
      pages: pages(2),
      wholeDocument: true,
      citePages: true,
    };
    expect(buildSystemPrompt(args)).toBe(buildSystemPrompt(args));
  });

  it('tells the model not to cite pages it cannot know', () => {
    const prompt = buildSystemPrompt({
      title: 'Notes',
      wholeDocument: false,
      citePages: false,
    });
    expect(prompt).toContain('Do not cite page numbers');
    expect(prompt).not.toContain('<document>');
    expect(prompt).not.toContain('<document_summary>');
  });
});

describe('buildTask', () => {
  it('asks for the correct option first on multiple choice', () => {
    const task = buildTask({
      message: 'Which organelle makes ATP?',
      notSureQuestion: {
        question: 'Which organelle makes ATP?',
        options: ['Nucleus', 'Mitochondrion', 'Ribosome'],
        questionType: 'Multiple Choice',
      },
    });
    expect(task).toContain('<question>Which organelle makes ATP?</question>');
    expect(task).toContain('a. Nucleus\nb. Mitochondrion\nc. Ribosome');
    expect(task).toContain('Start by saying which option is correct');
  });

  it('handles true/false statements', () => {
    const task = buildTask({
      message: 'q',
      notSureQuestion: {
        question: 'Cells',
        options: ['A', 'B'],
        questionType: 'Multiple True-False',
      },
    });
    expect(task).toContain('<statements>\na. A\nb. B\n</statements>');
  });

  it.each(['explain', 'simplify', 'define'])(
    'turns a %s highlight into a task about the highlighted text',
    (highlight) => {
      const task = buildTask({
        message: `${highlight} - osmosis`,
        highlight: { highlight, question: 'osmosis' },
      });
      expect(task).toContain('<highlighted_text>osmosis</highlighted_text>');
    },
  );

  it('has no task for a plain message (or an unknown highlight)', () => {
    expect(buildTask({ message: 'hi' })).toBeNull();
    expect(
      buildTask({
        message: 'x',
        highlight: { highlight: 'visualize', question: 'x' },
      }),
    ).toBeNull();
  });

  it('asks about an image', () => {
    expect(
      buildTask({ message: 'krebs cycle', imageUrl: 'https://x/y.png' }),
    ).toContain('"krebs cycle"');
  });
});

describe('buildUserTurn', () => {
  it('puts passages first, labelled by page, then the question', () => {
    const turn = buildUserTurn({
      request: { message: 'What makes ATP?' },
      passages: [
        { pageNumber: 4, text: 'Mitochondria make ATP.' },
        { pageNumber: null, text: 'Unnumbered.' },
      ],
    });
    expect(turn.indexOf('<passages>')).toBe(0);
    expect(turn).toContain(
      '<passage page="4">\nMitochondria make ATP.\n</passage>',
    );
    expect(turn).toContain('<passage>\nUnnumbered.\n</passage>');
    expect(turn.trim().endsWith("Student's message: What makes ATP?")).toBe(
      true,
    );
  });

  it('says when nothing matched', () => {
    const turn = buildUserTurn({ request: { message: 'q' }, passages: [] });
    expect(turn).toContain('No passages from the document matched');
  });

  it('has no passages in whole-document mode', () => {
    const turn = buildUserTurn({ request: { message: 'q' }, passages: null });
    expect(turn).toBe("Student's message: q");
  });

  it("asks for the reader's language", () => {
    expect(
      buildUserTurn({
        request: { message: 'q', language: 'es' },
        passages: null,
      }),
    ).toContain('Write your reply in Spanish.');
    expect(
      buildUserTurn({
        request: { message: 'q', language: 'en' },
        passages: null,
      }),
    ).not.toContain('Write your reply');
    expect(
      buildUserTurn({
        request: { message: 'q', language: '"><script>' },
        passages: null,
      }),
    ).not.toContain('Write your reply');
  });
});

describe('buildSearchQuery', () => {
  const history = [
    { sender: 'user', message: 'Explain the Krebs cycle' },
    {
      sender: 'system',
      message:
        'The Krebs cycle turns acetyl-CoA into energy carriers.\n**source text start**\nold\n**source text end**',
    },
  ];

  it('searches a highlight for the highlighted text', () => {
    expect(
      buildSearchQuery(
        {
          message: 'explain - osmosis',
          highlight: { highlight: 'explain', question: 'osmosis' },
        },
        history,
      ),
    ).toBe('osmosis');
  });

  it('searches a practice question with its options', () => {
    expect(
      buildSearchQuery(
        {
          message: 'q',
          notSureQuestion: { question: 'Which?', options: ['A', 'B'] },
        },
        [],
      ),
    ).toBe('Which?\nA\nB');
  });

  it('searches a full question as it is', () => {
    const message =
      'How does the electron transport chain produce ATP in mitochondria?';
    expect(buildSearchQuery({ message }, history)).toBe(message);
  });

  it('searches a short new question as it is', () => {
    expect(buildSearchQuery({ message: 'What is osmosis?' }, history)).toBe(
      'What is osmosis?',
    );
  });

  it.each([
    ['go on', true],
    ['Why?', true],
    ['tell me more!', true],
    ['Simpler please', true],
    ['Why is it important?', true],
    ['What does that mean for the cell?', true],
    ['What is osmosis?', false],
    ['How does the heart pump blood around the body?', false],
    [
      'Compare it to the long and detailed process of glycolysis in yeast cells',
      false,
    ],
  ])('treats "%s" as a follow-up: %s', (message, expected) => {
    expect(isFollowUp(message)).toBe(expected);
  });

  it('adds what a short follow-up follows up on', () => {
    const query = buildSearchQuery({ message: 'go on' }, history);
    expect(query).toContain('go on');
    expect(query).toContain('Explain the Krebs cycle');
    expect(query).toContain('acetyl-CoA');
    expect(query).not.toContain('source text');
  });
});

describe('historyToTurns', () => {
  it('maps senders to roles and strips old passages', () => {
    expect(
      historyToTurns([
        { sender: 'user', message: 'Q' },
        {
          sender: 'system',
          message: 'A **source text start** x **source text end**',
        },
        { sender: 'system', message: '   ' },
      ]),
    ).toEqual([
      { role: 'user', content: 'Q' },
      { role: 'assistant', content: 'A' },
    ]);
  });

  it('cuts very long replies', () => {
    const [turn] = historyToTurns([
      { sender: 'system', message: 'y'.repeat(20000) },
    ]);
    expect(turn.content.length).toBeLessThan(6100);
  });
});

describe('passagesFromHits', () => {
  it('finds each hit’s page, drops duplicates and sorts by page', () => {
    const doc = pages(5);
    const passages = passagesFromHits(
      ['Page 4 text', 'Page 2 text', 'Page 4 text', '', 'Not a page'],
      doc,
    );
    expect(passages).toEqual([
      { pageNumber: 2, text: 'Page 2 text' },
      { pageNumber: 4, text: 'Page 4 text' },
      { pageNumber: null, text: 'Not a page' },
    ]);
    expect(citedPageNumbers(passages)).toEqual([2, 4]);
  });

  it('gives no page numbers when they are unreliable', () => {
    const passages = passagesFromHits(
      ['Page 1 text'],
      pages(MAX_RELIABLE_PAGES),
    );
    expect(passages[0].pageNumber).toBeNull();
  });
});

describe('effortFor', () => {
  it('thinks harder about practice questions', () => {
    expect(
      effortFor({
        message: 'q',
        notSureQuestion: { question: 'q', questionType: 'Multiple Choice' },
      }),
    ).toBe('medium');
    expect(effortFor({ message: 'q' })).toBe('low');
  });
});

describe('parseChatRequest', () => {
  it('rejects a missing or empty message', () => {
    expect(parseChatRequest({})).toBeNull();
    expect(parseChatRequest({ message: '   ' })).toBeNull();
    expect(parseChatRequest({ message: 42 })).toBeNull();
    expect(parseChatRequest(null)).toBeNull();
    expect(parseChatRequest({ message: 'x'.repeat(20001) })).toBeNull();
  });

  it('keeps the parts it understands', () => {
    expect(
      parseChatRequest({
        message: 'explain - osmosis',
        courseDocumentId: 'doc',
        responseFormat: 'indepth',
        highlightToPrompt: { highlight: 'explain', question: 'osmosis' },
        notSureQuestion: {
          question: 'Q',
          options: ['A', 3, 'B'],
          questionType: 'Multiple Choice',
        },
        imageDescriptionData: { imageUrl: ' https://x/y.png ' },
        language: 'fr',
      }),
    ).toEqual({
      message: 'explain - osmosis',
      highlight: { highlight: 'explain', question: 'osmosis' },
      notSureQuestion: {
        question: 'Q',
        options: ['A', 'B'],
        questionType: 'Multiple Choice',
      },
      imageUrl: 'https://x/y.png',
      language: 'fr',
    });
  });

  it('ignores unknown highlight kinds', () => {
    expect(
      parseChatRequest({
        message: 'x',
        highlightToPrompt: { highlight: 'visualize', question: 'x' },
      })?.highlight,
    ).toBeUndefined();
  });
});

describe('chatRequestProblem', () => {
  it('says what is wrong', () => {
    expect(chatRequestProblem({ message: '' })).toBe('Type a message to send');
    expect(chatRequestProblem({ message: 'x'.repeat(20001) })).toContain(
      'too long',
    );
    expect(chatRequestProblem({ message: 'ok' })).toBeNull();
  });
});

describe('sseEvent', () => {
  it('formats one event, keeping newlines inside the JSON', () => {
    expect(sseEvent('delta', { text: 'a\nb' })).toBe(
      'event: delta\ndata: {"text":"a\\nb"}\n\n',
    );
  });
});
