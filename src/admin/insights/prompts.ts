/**
 * What Claude is asked to do for each label, and the exact shape of its answers (structured
 * outputs). Bump PROMPT_VERSION when an instruction changes, so old and new labels can be told apart.
 */

export const INSIGHTS_MODEL = 'claude-opus-5-5';
export const PROMPT_VERSION = 'v1';

const AUDIENCE = `AI Examiner is a study app used mostly by university students in Nigeria, many of them in medicine, pharmacy, nursing and other health sciences. Students upload their own lecture notes and slides; the app makes practice tests from them, answers questions about them in a document chat, and rewrites them in plain language (Easy Read).`;

/* ---------- Chat conversations ---------- */

export const CHAT_INTENTS = [
  'explain_concept',
  'summarise',
  'quiz_me',
  'find_in_document',
  'exam_prep',
  'clarify_previous_answer',
  'translate_or_simplify',
  'off_topic',
  'other',
] as const;

export const CHAT_ISSUES = [
  'wrong_or_made_up',
  'contradicted_document',
  'ignored_document',
  'too_long',
  'too_short_or_vague',
  'misunderstood_question',
  'had_to_repeat',
  'formatting',
  'app_error_or_slow',
  'language',
  'none',
] as const;

export const CHAT_SYSTEM = `You review conversations from AI Examiner's document chat so the team can improve it. ${AUDIENCE}

In the chat, a student asks about one of their uploaded documents and an assistant answers from it. You will see the document's title and the conversation. Long assistant answers are shortened, and the cut is marked.

Judge the student's experience from what the student wrote and did. Do not grade the assistant on your own taste, and do not guess beyond the evidence.

mood:
- satisfied: thanks the assistant, builds on an answer, moves on to a new question, or asks for more of the same.
- neutral: asks and leaves without any sign either way. Most one-question conversations are neutral.
- frustrated: complains, corrects the assistant, repeats or rephrases the same question, says the answer is wrong or not what they asked, uses angry words or capitals, or gives up straight after a poor answer.
- unclear: too little to tell, or written in a way you can't judge.

confidence: how sure you are about the mood.
intent: the main thing the student wanted.
outcome: resolved (they got what they wanted), partly, unresolved (they didn't), or abandoned (they left mid-way after a poor answer).
issues: every problem that applies, from the list. Use ["none"] when nothing went wrong.
summary: one plain sentence of at most 25 words about what the student wanted and how it went. No names.
quote: the student's own words that best show how it went, copied exactly, at most 30 words. Empty if nothing stands out.
fix_idea: one concrete improvement to AI Examiner this conversation suggests, at most 20 words. Empty if none.`;

export const CHAT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'mood',
    'confidence',
    'intent',
    'outcome',
    'issues',
    'summary',
    'quote',
    'fix_idea',
  ],
  properties: {
    mood: {
      type: 'string',
      enum: ['satisfied', 'neutral', 'frustrated', 'unclear'],
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    intent: { type: 'string', enum: [...CHAT_INTENTS] },
    outcome: {
      type: 'string',
      enum: ['resolved', 'partly', 'unresolved', 'abandoned'],
    },
    issues: {
      type: 'array',
      items: { type: 'string', enum: [...CHAT_ISSUES] },
    },
    summary: { type: 'string' },
    quote: { type: 'string' },
    fix_idea: { type: 'string' },
  },
};

/* ---------- Test attempts and essays ---------- */

export const TEST_ISSUES = [
  'too_hard',
  'too_easy',
  'poor_question_quality',
  'answer_key_looks_wrong',
  'repetitive',
  'too_long',
  'none',
] as const;

export const TEST_SYSTEM = `You review students' attempts at practice tests in AI Examiner so the team can improve them. ${AUDIENCE}

Each test was generated from the student's own document. You will see the test type, how many questions it had, whether the student finished, their score if they did, and each question they answered with its topic, their answer and the correct answer. For an essay you will see the question, the student's answer and the app's marking.

Judge the student's experience from their behaviour and results:
- satisfied: finished with a solid score, or worked steadily through the test.
- neutral: an ordinary attempt with no strong signal.
- frustrated: a run of wrong answers then stopping, a very low score, answers that look like random guesses, or signs the questions were unfair.
- unclear: too few answers to tell.

confidence: how sure you are about the mood.
outcome: completed, or abandoned (stopped before the end).
stop_reason: only for an abandoned attempt; use unknown unless the answers show a likely reason.
struggles: up to 3 topics they got most wrong, using the topic names given. Empty if none.
strengths: up to 3 topics they got right. Empty if none.
issues: every problem with the test itself that the answers suggest. Use ["none"] when there is no sign of one. Mark answer_key_looks_wrong only when a "correct" answer is clearly wrong.
summary: one plain sentence of at most 25 words. No names.
fix_idea: one concrete improvement to AI Examiner's tests this attempt suggests, at most 20 words. Empty if none.`;

export const TEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'mood',
    'confidence',
    'outcome',
    'stop_reason',
    'struggles',
    'strengths',
    'issues',
    'summary',
    'fix_idea',
  ],
  properties: {
    mood: {
      type: 'string',
      enum: ['satisfied', 'neutral', 'frustrated', 'unclear'],
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    outcome: { type: 'string', enum: ['completed', 'abandoned'] },
    stop_reason: {
      type: 'string',
      enum: [
        'not_applicable',
        'too_hard',
        'poor_questions',
        'lost_interest',
        'ran_out_of_time',
        'unknown',
      ],
    },
    struggles: { type: 'array', items: { type: 'string' } },
    strengths: { type: 'array', items: { type: 'string' } },
    issues: {
      type: 'array',
      items: { type: 'string', enum: [...TEST_ISSUES] },
    },
    summary: { type: 'string' },
    fix_idea: { type: 'string' },
  },
};

/* ---------- Documents ---------- */

export const DOCUMENT_FIELDS = [
  'medicine_and_surgery',
  'basic_medical_sciences',
  'pharmacy',
  'nursing',
  'dentistry',
  'other_health_sciences',
  'law',
  'engineering',
  'computing',
  'business_and_economics',
  'sciences',
  'arts_and_humanities',
  'social_sciences',
  'education',
  'other',
] as const;

export const DOCUMENT_KINDS = [
  'lecture_slides',
  'lecture_notes',
  'textbook_chapter',
  'past_questions',
  'research_or_article',
  'assignment_or_handout',
  'personal_notes',
  'other',
] as const;

export const DOCUMENT_LEVELS = [
  'secondary_or_entrance_exam',
  'early_university',
  'later_university',
  'postgraduate_or_professional',
  'unknown',
] as const;

export const DOCUMENT_SYSTEM = `You classify study documents that students upload to AI Examiner, so the team can see what people study with it. ${AUDIENCE}

You will see the document's file name, the list of topics the app extracted from it, and the start of its summary. Classify the document; don't summarise it at length.

field: the broad field it belongs to.
subject: the specific subject or course, in at most 5 words, e.g. "Renal pharmacology" or "Contract law".
kind: what sort of document it is.
level: the study level it looks written for; unknown if you can't tell.
language: the main language, e.g. English.
quality: clear, partial (the topics or summary suggest pages were missing or poorly extracted), or unreadable.
summary: what it covers, in one plain sentence of at most 20 words.`;

export const DOCUMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'field',
    'subject',
    'kind',
    'level',
    'language',
    'quality',
    'summary',
  ],
  properties: {
    field: { type: 'string', enum: [...DOCUMENT_FIELDS] },
    subject: { type: 'string' },
    kind: { type: 'string', enum: [...DOCUMENT_KINDS] },
    level: { type: 'string', enum: [...DOCUMENT_LEVELS] },
    language: { type: 'string' },
    quality: { type: 'string', enum: ['clear', 'partial', 'unreadable'] },
    summary: { type: 'string' },
  },
};

/* ---------- Follow-up emails ---------- */

/** Where a follow-up's button may point (Claude picks one; the server builds the URL). */
export const FOLLOW_UP_LINKS = [
  'home',
  'upload',
  'document',
  'test',
  'easy_read',
  'pricing',
] as const;

export const FOLLOW_UP_SYSTEM = `You draft short, personal follow-up emails from the AI Examiner team to a student. ${AUDIENCE}

You will get the reason the student is on today's follow-up list (a rule) and facts about what they did in the app. Write the email a thoughtful founder would send by hand.

Rules for the email:
- Be warm, plain and specific. Mention what they actually did (the document title, where they stopped, the topic) so it's clearly about them.
- Never say or hint that the team watched them, read their chats, or judged their mood. Never say "we noticed you were frustrated" or "our analysis shows". Refer only to things a student would expect an app to know: their documents, tests, scores and when they last visited.
- One clear next step, matching the button.
- 50 to 110 words in the body. Short paragraphs separated by a blank line. Start with "Hi {first name}," on its own line. No sign-off; the template adds one.
- British English. No emojis, no exclamation marks in a row, no discounts or promises that aren't in the facts.
- headline: a short title shown at the top of the email, at most 8 words.
- subject: at most 7 words, specific, no clickbait.
- button: where the one button goes. It is the only link in the email, so the next step must be something that page lets them do:
  - home: their list of documents
  - upload: the page for uploading a new document
  - document: the page for the document in the facts (its tests, chat and Easy Read)
  - test: reopens the test in the facts, to finish or retake it (only when the facts include a test)
  - easy_read: opens the document in the facts in Easy Read (only when the facts include a document)
  - pricing: the plans page
  To ask for feedback, a review or a story, ask them to reply to this email (replies reach the team) and keep the button to one of these pages.
- button_label: at most 4 words, saying exactly what that page is ("Finish your test", "Open your documents"). Never ask for a review, a reply or feedback through the button.
- reason: one sentence for the team (not the student) on why this email makes sense now, at most 25 words. Call the student by name or "they"; never guess their gender.`;

export const FOLLOW_UP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reason', 'subject', 'headline', 'body', 'button', 'button_label'],
  properties: {
    reason: { type: 'string' },
    subject: { type: 'string' },
    headline: { type: 'string' },
    body: { type: 'string' },
    button: { type: 'string', enum: [...FOLLOW_UP_LINKS] },
    button_label: { type: 'string' },
  },
};

/* ---------- Themes for a date range ---------- */

export const DIGEST_SYSTEM = `You turn AI Examiner's labelled feedback into a short report for the founders. ${AUDIENCE}

You will get labelled items from a date range: chat conversations, test attempts and documents, each with a mood, issues, a one-line summary and sometimes the student's own words. Group them into themes the team can act on.

- headline: the single most important finding, one sentence of at most 25 words, with a number.
- sections: one per kind that has items (chat, test, document). For chat and test, give up to 4 themes, largest first, about what went wrong or what students wanted. For documents, give up to 4 themes about what students study with the app and any gaps.
- Each theme: a short title (at most 8 words), how many items it covers (count them; don't estimate), one quote copied exactly from the items (empty if none fits), and one concrete fix (at most 20 words).
- bright_spots: up to 3 short sentences on what's working well, with numbers.
Use only what the items show. Don't invent numbers.`;

export const DIGEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'sections', 'bright_spots'],
  properties: {
    headline: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'themes'],
        properties: {
          kind: { type: 'string', enum: ['chat', 'test', 'document'] },
          themes: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'count', 'quote', 'fix'],
              properties: {
                title: { type: 'string' },
                count: { type: 'integer' },
                quote: { type: 'string' },
                fix: { type: 'string' },
              },
            },
          },
        },
      },
    },
    bright_spots: { type: 'array', items: { type: 'string' } },
  },
};

/** Batch prices for Claude Opus 5.5 (half the list price), in dollars per million tokens. */
/* ---------- Translation ---------- */

export const TRANSLATE_SYSTEM = `You translate messages from AI Examiner's document chat into clear, natural British English, so the team can read conversations held in other languages. ${AUDIENCE}

For each item:
- language: the language it is written in, in English ("Hindi", "Hinglish (Hindi in Latin letters)", "Yoruba", "French", "English"). Name a mix by its main language.
- english: a faithful translation. Keep the meaning, tone and every detail; don't summarise, explain, add or drop anything. Keep the formatting: markdown headings, lists, numbering, bold, option letters, ticks such as ✔, page references and line breaks. Leave names, document titles, code and numbers as they are.
- When an item is already entirely in English, give an empty string for english.`;

export const TRANSLATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'language', 'english'],
        properties: {
          id: { type: 'string' },
          language: { type: 'string' },
          english: { type: 'string' },
        },
      },
    },
  },
};

/* ---------- Product ideas ---------- */

export const IDEA_AREAS = [
  'chat',
  'tests',
  'easy_read',
  'uploads',
  'first_visit',
  'coming_back',
  'pricing',
  'other',
] as const;

export const IDEAS_SYSTEM = `You are the product analyst inside AI Examiner's admin, writing for the two founders. ${AUDIENCE}

You will get evidence from the last 90 days: counts from Claude's labels of chats, tests and uploads; Claude's fix idea for individual items; real student quotes (each with an example id); the sign-up funnel; how many students come back in the weeks after signing up; how tests are started, finished and abandoned; Easy Read use; live tracking from the app when there is any (how many students get through each step from the upload page to a finished test, how long uploads, test generation and chat replies take, failures, limits hit and the pages where visits end); last week's themes; and ideas the team has already planned, shipped or turned down.

Propose 5 to 8 concrete things the team could build or change in the app that would solve problems students actually hit, or bring back students who try it once and leave.

Rules:
- Every idea rests on the evidence. Quote counts from it in evidence, and pick 1 to 3 example ids whose quotes show the problem. Never invent a number, a quote or a feature that exists.
- Example ids (c12, t40…) go only in example_ids. Never write them in the title, problem, proposal, first step or evidence: the team never sees them.
- Be specific and buildable: name the moment in the app (the chat panel, the score screen, the first visit, the Easy Read limit…), what changes, and a first step a small team could ship within a week.
- Favour high impact for little effort, but include one or two bigger bets when the evidence is strong. At least one idea must be about students who sign up and don't come back.
- Don't repeat an idea that is planned, done or turned down. You may build on a planned one.
- impact: high, medium or low, from how many students it would help and how much. effort: small (days), medium (one to three weeks) or large.
- students_affected: your estimate for the 90 days, from the counts.
- area: chat, tests, easy_read, uploads, first_visit, coming_back, pricing or other.
- British English, short plain sentences, no marketing language. Refer to students as "students" or "they".`;

export const IDEAS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ideas'],
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'title',
          'area',
          'problem',
          'proposal',
          'first_step',
          'impact',
          'effort',
          'students_affected',
          'evidence',
          'example_ids',
        ],
        properties: {
          title: { type: 'string' },
          area: { type: 'string', enum: [...IDEA_AREAS] },
          problem: { type: 'string' },
          proposal: { type: 'string' },
          first_step: { type: 'string' },
          impact: { type: 'string', enum: ['high', 'medium', 'low'] },
          effort: { type: 'string', enum: ['small', 'medium', 'large'] },
          students_affected: { type: 'integer' },
          evidence: { type: 'array', items: { type: 'string' } },
          example_ids: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

export const BATCH_PRICE = {
  input: 2,
  cacheWrite: 2.5,
  cacheRead: 0.1,
  output: 10,
};
/** List prices for direct calls (follow-up drafts on demand, Ask Claude, themes). */
export const DIRECT_PRICE = {
  input: 4,
  cacheWrite: 5,
  cacheRead: 0.2,
  output: 20,
};

export const costOf = (
  t: { input: number; cacheWrite: number; cacheRead: number; output: number },
  price = BATCH_PRICE,
) =>
  (t.input * price.input +
    t.cacheWrite * price.cacheWrite +
    t.cacheRead * price.cacheRead +
    t.output * price.output) /
  1_000_000;
