/**
 * The marketing template catalog: what each template is for, which content fields the editor
 * shows for it (in the order they appear in the email) and its default content, taken from the
 * approved designs. Render with renderMarketingEmail (render.ts).
 */
import { CampaignContent, TemplateKey } from './types';

export interface MarketingTemplate {
  key: TemplateKey;
  title: string;
  use: string;
  fields: (keyof CampaignContent)[];
  defaults: CampaignContent;
  defaultSubject: string;
  defaultPreheader: string;
}

/** A 1200×680 crop, so clients that can't crop (Gmail, Outlook) show it at the designed shape. */
export const DEFAULT_IMAGE_URL =
  'https://aiexaminer.app/home/redesign/email-student-wide.jpg';
const SITE = 'https://aiexaminer.app';
const DOCUMENTS = `${SITE}/documents`;

const item = (title: string, text = '') => ({ title, text });

export const MARKETING_TEMPLATES: MarketingTemplate[] = [
  {
    key: 'announcement',
    title: 'Announcement',
    use: 'Big news: a launch or an update',
    fields: [
      'colorSet',
      'headline',
      'highlight',
      'subhead',
      'imageUrl',
      'imageAlt',
      'body',
      'items',
      'button',
      'signoff',
    ],
    defaults: {
      colorSet: 'ink_yellow',
      headline: 'Your notes, simplified in seconds',
      highlight: 'simplified',
      subhead:
        'Easy Read now opens your document straight away and simplifies each page while you read.',
      imageUrl: DEFAULT_IMAGE_URL,
      imageAlt: 'A student reading her notes',
      body: 'Hi {first name},\n\nYou told us waiting for a long document to simplify was the slowest part of studying with AI Examiner. So we rebuilt it. Here’s what changes for you.',
      items: [
        item(
          'Opens straight away',
          'Your original document is ready the moment you tap it.',
        ),
        item(
          'Simplifies as you read',
          'Each page is rewritten in plain language just ahead of where you are.',
        ),
        item(
          'Keeps every exam term',
          'Key words stay in brackets, so you learn the language your examiners use.',
        ),
      ],
      button: { label: 'Try Easy Read', url: DOCUMENTS },
      signoff: 'Happy studying,',
    },
    defaultSubject: 'Your notes, simplified in seconds',
    defaultPreheader:
      'Easy Read now opens your document straight away and simplifies each page while you read.',
  },
  {
    key: 'newsletter',
    title: 'Study notes',
    use: 'A monthly newsletter with tips',
    fields: [
      'colorSet',
      'issueLabel',
      'body',
      'imageUrl',
      'imageAlt',
      'headline',
      'highlight',
      'subhead',
      'items',
      'quote',
      'cards',
      'button',
      'signoff',
    ],
    defaults: {
      colorSet: 'purple_cream',
      issueLabel: 'No. 11 · November 2026',
      body: 'Hi {first name}, exam season is close. This month: how to revise in shorter sessions, and a faster Easy Read.',
      imageUrl: DEFAULT_IMAGE_URL,
      imageAlt: 'A student reading her notes',
      headline: '5 ways to revise smarter this month',
      subhead:
        'Short, frequent sessions beat one long night. Here is how students on AI Examiner are fitting revision around lectures and ward rounds.',
      items: [
        item(
          'Study in 25-minute blocks',
          'Take a 5-minute break between them, and a longer one every two hours.',
        ),
        item(
          'Test yourself first',
          'Take a 10-question test before you reread. Your mistakes show you where to look.',
        ),
        item(
          'Read the hard pages simplified',
          'Switch a dense page to Simplified, then back to the original once it clicks.',
        ),
        item(
          'Say it out loud',
          'A five-minute viva shows what you can explain, not just recognise.',
        ),
        item(
          'Review your wrong answers',
          'Every explanation links to the page it came from.',
        ),
      ],
      quote: {
        text: 'This is literally the most helpful tool for any medical student, period.',
        by: 'IOTA · on X',
      },
      cards: [
        {
          title: 'Easy Read, faster',
          text: 'Your document opens straight away and simplifies as you read.',
          linkLabel: 'Open a document',
          url: DOCUMENTS,
        },
        {
          title: 'Practise out loud',
          text: 'An oral viva on your own notes, marked with feedback.',
          linkLabel: 'Start a viva',
          url: DOCUMENTS,
        },
      ],
      button: { label: 'Start revising', url: DOCUMENTS },
      signoff: 'See you next month,',
    },
    defaultSubject: 'Study notes: 5 ways to revise smarter this month',
    defaultPreheader:
      'Exam season is close. How to revise in shorter sessions, and a faster Easy Read.',
  },
  {
    key: 'offer',
    title: 'Offer',
    use: 'A discount or a deadline',
    fields: [
      'colorSet',
      'offer',
      'headline',
      'highlight',
      'body',
      'itemsTitle',
      'items',
      'button',
    ],
    defaults: {
      colorSet: 'yellow_ink',
      offer: {
        intro: 'Exam season offer',
        big: '30%',
        line: 'off the Quarterly plan',
        deadline: 'Ends Sunday 30 November, midnight',
        deadlineNote: '3 days left',
        code: 'EXAM30',
        fineprint:
          'New Quarterly subscriptions only. Renews at the usual price after the first quarter. Cancel any time.',
      },
      headline: 'off the Quarterly plan',
      body: 'Hi {first name},\n\nYour exams are coming. For the next three days, the Quarterly plan is 30% off, so you can study with everything AI Examiner has until the end of term.',
      itemsTitle: 'What you get',
      items: [
        item('Unlimited practice tests from your own notes'),
        item('Easy Read on every document, with no monthly limit'),
        item('Oral viva practice with feedback on every answer'),
        item('Chat with your documents, with page references'),
      ],
      button: { label: 'Claim 30% off', url: `${SITE}/pricing` },
    },
    defaultSubject: '30% off the Quarterly plan, for three days',
    defaultPreheader:
      'Exam season offer: use EXAM30 at checkout. Ends Sunday 30 November, midnight.',
  },
  {
    key: 'spotlight',
    title: 'Feature spotlight',
    use: 'Show one feature, step by step',
    fields: [
      'colorSet',
      'headline',
      'highlight',
      'subhead',
      'body',
      'beforeAfter',
      'itemsTitle',
      'items',
      'button',
      'signoff',
    ],
    defaults: {
      colorSet: 'purple_cream',
      headline: 'Meet\nEasy Read',
      subhead:
        'Dense lecture notes, rewritten in plain language page by page, with every exam term kept.',
      body: 'Hi {first name}, here is the same paragraph before and after Easy Read.',
      beforeAfter: {
        before:
          'The first heart sound (S1) is produced by closure of the atrioventricular valves at the onset of ventricular systole. The second heart sound (S2) results from closure of the semilunar valves at the end of ventricular ejection.',
        after:
          'The first heart sound (S1) happens when the valves between the upper and lower chambers snap shut (atrioventricular valves). This happens just as the lower chambers start to squeeze (ventricular systole).',
      },
      itemsTitle: 'Three taps to try it',
      items: [
        item(
          'Open any document',
          'Pick lecture notes, slides or a textbook chapter.',
        ),
        item(
          'Tap Easy Read',
          'Your original opens at once; simplified pages follow as you read.',
        ),
        item(
          'Tap a hard phrase',
          'Explain it, simplify it more, or get the definition.',
        ),
      ],
      button: { label: 'Open Easy Read', url: DOCUMENTS },
      signoff: 'Happy studying,',
    },
    defaultSubject: 'Meet Easy Read',
    defaultPreheader:
      'Dense lecture notes, rewritten in plain language page by page, with every exam term kept.',
  },
  {
    key: 'comeback',
    title: 'Come back',
    use: 'For people who haven’t been in for a while',
    fields: [
      'colorSet',
      'headline',
      'highlight',
      'body',
      'resume',
      'itemsTitle',
      'items',
      'button',
      'signoff',
    ],
    defaults: {
      colorSet: 'ink_yellow',
      headline: 'Your notes are right where you left them.',
      highlight: 'left them.',
      body: 'Hi {first name}, it has been a few weeks. Your documents, tests and progress are all saved, so you can pick up in one tap.',
      resume: {
        title: 'Renal Pharmacology',
        subtitle: 'You read 14 of 36 pages · last test 17 of 20',
        progress: 39,
        buttonLabel: 'Pick up at page 15',
        url: DOCUMENTS,
      },
      itemsTitle: 'New since you were here',
      items: [
        item(
          'Easy Read opens straight away',
          'Simplified pages now arrive as you read, not all at the end.',
        ),
        item(
          'Chat answers as it writes',
          'Ask your document a question and watch the answer appear.',
        ),
        item(
          'A cleaner, calmer app',
          'A fresh look, and a dark mode for late-night revision.',
        ),
      ],
      button: { label: 'Open AI Examiner', url: `${SITE}/` },
      signoff: 'We’re here when you’re ready,',
    },
    defaultSubject: 'Your notes are right where you left them',
    defaultPreheader:
      'Your documents, tests and progress are all saved. Pick up in one tap.',
  },
  {
    key: 'live',
    title: 'Live session',
    use: 'An invite with a date and time',
    fields: [
      'colorSet',
      'event',
      'headline',
      'highlight',
      'body',
      'itemsTitle',
      'items',
      'button',
    ],
    defaults: {
      colorSet: 'ink_yellow',
      event: {
        weekday: 'THU',
        day: '4',
        month: 'DEC',
        time: '7 pm WAT',
        host: '[HOST NAME]',
        hostRole: '[HOST ROLE, e.g. final-year medical student]',
        calendarUrl:
          'https://calendar.google.com/calendar/render?action=TEMPLATE&text=How%20to%20prepare%20for%20your%20oral%20viva&dates=20251204T180000Z/20251204T190000Z',
      },
      headline: 'How to prepare for your oral viva',
      body: 'Hi {first name}, join us for an hour on what examiners listen for, how to structure an answer out loud, and a live practice viva you can watch.',
      itemsTitle: 'In the hour',
      items: [
        item('7:00', 'What examiners listen for'),
        item('7:15', 'Structuring an answer out loud'),
        item('7:30', 'A live practice viva on AI Examiner'),
        item('7:45', 'Your questions'),
      ],
      button: { label: 'Save my seat', url: `${SITE}/` },
    },
    defaultSubject: 'Live: how to prepare for your oral viva',
    defaultPreheader:
      'Thursday 4 December, 7 pm WAT. One hour, online and free.',
  },
  {
    key: 'letter',
    title: 'Plain letter',
    use: 'A personal note, like an email from you',
    fields: ['colorSet', 'headline', 'highlight', 'body', 'button', 'signoff'],
    defaults: {
      colorSet: 'white_purple',
      headline: 'A quick note from the team',
      body: 'Hi {first name},\n\nWe’re medical students too. We built AI Examiner because revising from dense notes was the hardest part of our week, and we still use it for our own exams.\n\nIf something would make studying easier for you, we’d love to hear it. Every idea gets read.',
      button: { label: 'Open AI Examiner', url: `${SITE}/` },
      signoff: 'Speak soon,',
    },
    defaultSubject: 'A quick note from the AI Examiner team',
    defaultPreheader:
      'Why we built AI Examiner, and what we’d love to hear from you.',
  },
];

export function getTemplate(key: TemplateKey): MarketingTemplate | undefined {
  return MARKETING_TEMPLATES.find((t) => t.key === key);
}
