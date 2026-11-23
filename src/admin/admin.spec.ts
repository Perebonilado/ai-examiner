import { JwtService } from '@nestjs/jwt';
import {
  EventRow,
  describeEvent,
  eventsUnion,
  onlineFromSignals,
  readingLength,
} from './events';
import { looksLikeEmail, normalEmail } from './adminAccess';
import { cleanPath } from './telemetry/TelemetryService';
import { bucketIndexOf, mondayOf } from './analytics';
import { cleanDocumentId, watHour } from './readingTime';
import {
  MAX_RANGE_DAYS,
  allowedGranularities,
  bucketsOf,
  makeRange,
  parseRange,
  pickGranularity,
  previousRange,
} from './range';
import { planDays } from './services/CampaignService';
import { classifySendError } from './services/CampaignSender';
import { EmailLinkService } from './services/EmailLinkService';
import {
  addDays,
  describeDevice,
  lastWatDays,
  watDay,
  watDayStart,
} from './time';

describe('WAT days', () => {
  it('uses Lagos time: 23:30 UTC is already the next day', () => {
    expect(watDay(new Date('2026-11-22T23:30:00Z'))).toBe('2026-11-23');
    expect(watDay(new Date('2026-11-22T22:59:00Z'))).toBe('2026-11-22');
  });

  it('a WAT day starts at 23:00 UTC the evening before', () => {
    expect(watDayStart('2026-11-23').toISOString()).toBe(
      '2026-11-22T23:00:00.000Z',
    );
  });

  it('lists the last n days, oldest first, ending today', () => {
    const days = lastWatDays(3, new Date('2026-11-22T12:00:00Z'));
    expect(days).toEqual(['2026-11-20', '2026-11-21', '2026-11-22']);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('describeDevice', () => {
  it('names common browsers and systems', () => {
    expect(
      describeDevice(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36',
      ),
    ).toBe('Chrome · Android');
    expect(
      describeDevice(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
      ),
    ).toBe('Safari · Mac');
    expect(
      describeDevice(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari · iPhone');
    expect(
      describeDevice(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0 Safari/537.36 Edg/131.0',
      ),
    ).toBe('Edge · Windows');
    expect(describeDevice(undefined)).toBeNull();
  });
});

describe('planDays (daily sending limit)', () => {
  it('fills today’s remaining room, then 400 a day', () => {
    expect(planDays(1000, 0, 150, 400, '2026-11-22')).toEqual([
      { date: '2026-11-22', count: 150 },
      { date: '2026-11-23', count: 400 },
      { date: '2026-11-24', count: 400 },
      { date: '2026-11-25', count: 50 },
    ]);
  });

  it('waits behind emails already queued by earlier campaigns', () => {
    expect(planDays(300, 500, 400, 400, '2026-11-22')).toEqual([
      { date: '2026-11-23', count: 300 },
    ]);
  });

  it('starts tomorrow when today is used up', () => {
    expect(planDays(10, 0, 0, 400, '2026-11-22')).toEqual([
      { date: '2026-11-23', count: 10 },
    ]);
  });

  it('plans nothing for nobody', () => {
    expect(planDays(0, 0, 400, 400, '2026-11-22')).toEqual([]);
  });
});

describe('classifySendError', () => {
  it('retries when the problem is not the address', () => {
    expect(classifySendError(new Error('connect ETIMEDOUT'))).toBe('retry');
    expect(
      classifySendError({
        responseCode: 421,
        response: '421 4.7.0 Try again later',
      }),
    ).toBe('retry');
    expect(
      classifySendError({
        responseCode: 535,
        response: '535 5.7.8 Username and Password not accepted',
      }),
    ).toBe('retry');
    expect(
      classifySendError({
        responseCode: 550,
        response: '550-5.4.5 Daily user sending limit exceeded.',
      }),
    ).toBe('retry');
    expect(
      classifySendError({
        responseCode: 550,
        response: '550 5.4.5 Daily sending quota exceeded',
      }),
    ).toBe('retry');
  });

  it('marks a missing mailbox as a bounce', () => {
    expect(
      classifySendError({
        responseCode: 550,
        response:
          '550 5.1.1 The email account that you tried to reach does not exist',
      }),
    ).toBe('bounce');
    expect(
      classifySendError({
        responseCode: 553,
        response: '553 5.1.2 Invalid recipient address',
      }),
    ).toBe('bounce');
  });

  it('fails other single-email problems without blocking the address', () => {
    expect(
      classifySendError({
        responseCode: 552,
        response: '552 5.2.2 Mailbox full',
      }),
    ).toBe('fail');
    expect(
      classifySendError({
        responseCode: 552,
        response:
          '552-5.2.2 The email account that you tried to reach is over quota',
      }),
    ).toBe('fail');
    expect(
      classifySendError({
        responseCode: 554,
        response: '554 5.7.1 Message rejected as spam',
      }),
    ).toBe('fail');
  });
});

describe('EmailLinkService', () => {
  const OLD_ENV = process.env;
  beforeAll(() => {
    process.env = {
      ...OLD_ENV,
      JWT_SECRET: 'test-secret',
      BACKEND_PUBLIC_URL: 'https://api.example.com/',
      FRONTEND_BASE_URL: 'https://aiexaminer.app/',
      Email_user: 'team@example.com',
    };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  const links = () => new EmailLinkService(new JwtService({}));

  it('round-trips an unsubscribe token, with and without a campaign', () => {
    const l = links();
    expect(l.readPreferenceToken(l.preferenceToken('u1', 'c1'))).toEqual({
      userId: 'u1',
      campaignId: 'c1',
    });
    expect(l.readPreferenceToken(l.preferenceToken('u1'))).toEqual({
      userId: 'u1',
      campaignId: null,
    });
    expect(l.readPreferenceToken('nonsense')).toBeNull();
  });

  it('does not accept a click token as an unsubscribe token, or the reverse', () => {
    const l = links();
    expect(
      l.readPreferenceToken(
        l.clickToken('c1', 'u1', 'https://aiexaminer.app', 'Open'),
      ),
    ).toBeNull();
    expect(l.readClickToken(l.preferenceToken('u1'))).toBeNull();
  });

  it('tracks only http(s) links, through this API', () => {
    const l = links();
    const tracked = l.trackedUrl(
      'c1',
      'u1',
      'https://aiexaminer.app/pricing',
      'Claim',
    );
    expect(tracked.startsWith('https://api.example.com/api/v1/email/c/')).toBe(
      true,
    );
    const token = tracked.split('/email/c/')[1];
    expect(l.readClickToken(token)).toEqual({
      campaignId: 'c1',
      userId: 'u1',
      url: 'https://aiexaminer.app/pricing',
      label: 'Claim',
    });
    expect(l.trackedUrl('c1', 'u1', 'mailto:x@y.z', 'Mail')).toBe(
      'mailto:x@y.z',
    );
  });

  it('builds the unsubscribe page link and one-click headers', () => {
    const l = links();
    const token = l.preferenceToken('u1', 'c1');
    expect(l.unsubscribePageUrl(token)).toBe(
      `https://aiexaminer.app/unsubscribe?token=${encodeURIComponent(token)}`,
    );
    const headers = l.listUnsubscribeHeaders(token);
    expect(headers['List-Unsubscribe']).toContain(
      '<https://api.example.com/api/v1/email/unsubscribe/one-click?token=',
    );
    expect(headers['List-Unsubscribe']).toContain(
      '<mailto:team@example.com?subject=unsubscribe>',
    );
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });
});

describe('activity from the live tables', () => {
  const row = (over: Partial<EventRow>): EventRow => ({
    id: 'x',
    type: 'upload',
    user_id: 'u1',
    created_on: new Date('2026-11-22T10:00:00Z'),
    doc_id: null,
    num: null,
    extra: null,
    ...over,
  });
  const titles = new Map([['d1', 'Renal Pharmacology']]);
  const plans = new Map([
    ['PLN_q', 'Quarterly'],
    ['PLN_m', 'Monthly Plan'],
  ]);

  it('words each kind of event', () => {
    expect(
      describeEvent(row({ type: 'sign_up', extra: 'google' }), titles, plans),
    ).toBe('signed up with Google');
    expect(
      describeEvent(row({ type: 'sign_up', extra: 'email' }), titles, plans),
    ).toBe('signed up with email');
    expect(
      describeEvent(
        row({ type: 'upload', extra: 'Anatomy.pdf' }),
        titles,
        plans,
      ),
    ).toBe('uploaded Anatomy.pdf');
    expect(
      describeEvent(
        row({ type: 'test_generated', doc_id: 'd1', num: 4 }),
        titles,
        plans,
      ),
    ).toBe('made flashcards from Renal Pharmacology');
    expect(
      describeEvent(
        row({ type: 'test_finished', doc_id: 'd1', num: 78.6 }),
        titles,
        plans,
      ),
    ).toBe('finished a test on Renal Pharmacology and scored 79%');
    expect(
      describeEvent(row({ type: 'chat', doc_id: 'gone' }), titles, plans),
    ).toBe('asked a question about a document');
    expect(
      describeEvent(
        row({ type: 'viva', doc_id: 'd1', extra: 'started' }),
        titles,
        plans,
      ),
    ).toBe('started an oral viva on Renal Pharmacology');
    expect(
      describeEvent(
        row({ type: 'viva', doc_id: 'd1', extra: 'finished' }),
        titles,
        plans,
      ),
    ).toBe('finished an oral viva on Renal Pharmacology');
  });

  it('names plans once, and falls back when Paystack is unknown', () => {
    expect(
      describeEvent(row({ type: 'purchase', extra: 'PLN_q' }), titles, plans),
    ).toBe('paid for the Quarterly plan');
    expect(
      describeEvent(row({ type: 'purchase', extra: 'PLN_m' }), titles, plans),
    ).toBe('paid for the Monthly Plan');
    expect(
      describeEvent(row({ type: 'purchase', extra: 'PLN_x' }), titles, plans),
    ).toBe('bought a one-time plan');
    expect(describeEvent(row({ type: 'purchase' }), titles, plans)).toBe(
      'started a subscription',
    );
  });

  it('builds one branch per matching source, each filtered on its own date column', () => {
    const r: Record<string, unknown> = {};
    const sql = eventsUnion(
      { types: ['viva'], from: new Date(0), userIds: ['u1'], limit: 5 },
      r,
    )!;
    expect(sql.split('UNION ALL')).toHaveLength(2);
    expect(sql).toContain('q.question_type_id = 6');
    expect(sql).toContain('o.created_on >= :evFrom');
    expect(sql).toContain('oq.user_id IN (:evUsers)');
    expect(sql).toContain('ORDER BY q.created_on DESC LIMIT 5');
    expect(r).toEqual({ evFrom: new Date(0), evUsers: ['u1'] });
    expect(eventsUnion({ userIds: [] }, {})).toBeNull();
    expect(eventsUnion({}, {})!.split('UNION ALL')).toHaveLength(10);
    expect(eventsUnion({ types: ['easy_read'] }, {})).toContain(
      'FROM easy_read_reading r',
    );
    expect(eventsUnion({ types: ['sign_in'] }, {})).toContain(
      "a.type IN ('sign_in')",
    );
    // Both question kinds wanted: the question branch isn't narrowed.
    const both = eventsUnion({ types: ['viva', 'test_generated'] }, {})!;
    expect(both).not.toContain('question_type_id = 6 AND');
    expect(both).not.toContain('q.question_type_id <> 6');
    expect(both.split('UNION ALL')).toHaveLength(2);
    expect(
      eventsUnion({ types: ['upload'], limit: 3, order: 'asc' }, {}),
    ).toContain('ORDER BY d.created_on ASC LIMIT 3');
    expect(eventsUnion({ types: ['nonsense' as any] }, {})).toBeNull();
  });

  it('counts someone online from a heartbeat, or from an action in the last 5 minutes', () => {
    const now = new Date('2026-11-22T12:00:00Z');
    const at = (minAgo: number) => new Date(now.getTime() - minAgo * 60000);
    const online = onlineFromSignals(
      [
        {
          user_id: 'heartbeat',
          kind: 'presence',
          at: at(1),
          doing: 'Reading in Easy Read · Anatomy',
          session_started_at: at(20),
        },
        {
          user_id: 'tester',
          kind: 'answering',
          at: at(2),
          doing: null,
          session_started_at: null,
        },
        {
          user_id: 'tester',
          kind: 'test_generated',
          at: at(30),
          doing: null,
          session_started_at: null,
        },
        {
          user_id: 'gone',
          kind: 'chat',
          at: at(12),
          doing: null,
          session_started_at: null,
        },
      ],
      now,
    );
    expect([...online.keys()].sort()).toEqual(['heartbeat', 'tester']);
    expect(online.get('heartbeat')!.doing).toBe(
      'Reading in Easy Read · Anatomy',
    );
    expect(online.get('heartbeat')!.since).toEqual(at(20));
    expect(online.get('tester')!.doing).toBe('Taking a test');
    expect(online.get('tester')!.since).toEqual(at(30));
    expect(online.get('tester')!.lastAt).toEqual(at(2));
  });
});

describe('admin date ranges', () => {
  const now = new Date('2026-11-23T10:00:00Z');

  it('reads from/to as whole WAT days, never past today, and falls back to the last 30 days', () => {
    const r = parseRange('2026-10-25', '2026-11-23', now);
    expect(r).toMatchObject({ from: '2026-10-25', to: '2026-11-23', days: 30 });
    expect(r.start.toISOString()).toBe('2026-10-24T23:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-11-23T23:00:00.000Z');
    expect(parseRange(undefined, undefined, now)).toMatchObject({
      from: '2026-10-25',
      to: '2026-11-23',
    });
    expect(parseRange('2026-11-20', '2027-01-01', now).to).toBe('2026-11-23');
    expect(parseRange('2026-11-20', '2026-11-10', now)).toMatchObject({
      from: '2026-11-10',
      to: '2026-11-20',
    });
    expect(parseRange('2026-02-30', 'nope', now, 7)).toMatchObject({
      from: '2026-11-17',
      to: '2026-11-23',
    });
    expect(parseRange('2010-01-01', undefined, now).days).toBe(MAX_RANGE_DAYS);
  });

  it('compares with the same number of days just before', () => {
    const prev = previousRange(makeRange('2026-11-01', '2026-11-30'));
    expect(prev).toMatchObject({
      from: '2026-10-02',
      to: '2026-10-31',
      days: 30,
    });
  });

  it('splits a range into days, 7-day runs from its start, or calendar months', () => {
    const range = makeRange('2026-10-25', '2026-11-23');
    expect(bucketsOf(range, 'day')).toHaveLength(30);
    const weeks = bucketsOf(range, 'week');
    expect(weeks[0]).toEqual({ start: '2026-10-25', end: '2026-10-31' });
    expect(weeks[weeks.length - 1]).toEqual({
      start: '2026-11-22',
      end: '2026-11-23',
    });
    expect(bucketsOf(range, 'month')).toEqual([
      { start: '2026-10-25', end: '2026-10-31' },
      { start: '2026-11-01', end: '2026-11-23' },
    ]);
    expect(bucketIndexOf(weeks, '2026-11-01')).toBe(1);
    expect(bucketIndexOf(weeks, '2026-12-01')).toBe(-1);
  });

  it('picks a granularity that suits the length', () => {
    expect(pickGranularity(undefined, 7)).toBe('day');
    expect(pickGranularity(undefined, 180)).toBe('week');
    expect(pickGranularity(undefined, 900)).toBe('month');
    expect(pickGranularity('month', 30)).toBe('day');
    expect(pickGranularity('week', 90)).toBe('week');
    expect(allowedGranularities(7)).toEqual(['day']);
    expect(allowedGranularities(365)).toEqual(['week', 'month']);
  });

  it('finds the Monday of a week', () => {
    expect(mondayOf('2026-11-23')).toBe('2026-11-23');
    expect(mondayOf('2026-11-22')).toBe('2026-11-16');
  });
});

describe('Easy Read reading time', () => {
  it('words a day of reading with its length', () => {
    const row = (seconds: number, doc: string | null): EventRow => ({
      id: 'r:1',
      type: 'easy_read',
      user_id: 'u',
      created_on: new Date(),
      doc_id: doc,
      num: seconds,
      extra: null,
    });
    const titles = new Map([['d1', 'Renal Pharmacology']]);
    expect(describeEvent(row(754, 'd1'), titles, new Map())).toBe(
      'read Renal Pharmacology in Easy Read for 13 min',
    );
    expect(describeEvent(row(30, null), titles, new Map())).toBe(
      'read a document in Easy Read for under a minute',
    );
    expect(readingLength(3900)).toBe('1 h 05 min');
  });

  it('files reading under the Lagos hour', () => {
    expect(watHour(new Date('2026-11-23T23:30:00Z'))).toBe(0);
    expect(watHour(new Date('2026-11-23T13:10:00Z'))).toBe(14);
  });

  it('keeps only real document ids', () => {
    expect(cleanDocumentId('3f1c2a9e-8b7d-4c1e-9f00-123456789abc')).toBe(
      '3f1c2a9e-8b7d-4c1e-9f00-123456789abc',
    );
    expect(cleanDocumentId("x'; DROP TABLE user; --")).toBe('');
    expect(cleanDocumentId(42)).toBe('');
    expect(cleanDocumentId(undefined)).toBe('');
    expect(cleanDocumentId('a'.repeat(65))).toBe('');
  });
});

describe('admin access', () => {
  it('compares emails without case or spaces, and only takes real-looking addresses', () => {
    expect(normalEmail('  Ada.Okafor@Example.com ')).toBe(
      'ada.okafor@example.com',
    );
    expect(normalEmail(null)).toBe('');
    expect(looksLikeEmail('ada@example.com')).toBe(true);
    expect(looksLikeEmail('ada@example')).toBe(false);
    expect(looksLikeEmail('ada example@x.com')).toBe(false);
    expect(looksLikeEmail('')).toBe(false);
  });
});

describe('event paths', () => {
  it('drops query strings and replaces ids', () => {
    expect(
      cleanPath(
        '/questions/view-questions/87d62136-9a89-4032-bf9b-f994b7a31c88?x=1#top',
      ),
    ).toBe('/questions/view-questions/:id');
    expect(cleanPath('/documents/1234567')).toBe('/documents/:id');
    expect(
      cleanPath('/questions/practise-questions/multiple-choice/[id]'),
    ).toBe('/questions/practise-questions/multiple-choice/[id]');
  });
  it('ignores anything that is not a path', () => {
    expect(cleanPath('https://evil.example/x')).toBeNull();
    expect(cleanPath(42)).toBeNull();
    expect(cleanPath(undefined)).toBeNull();
  });
});
