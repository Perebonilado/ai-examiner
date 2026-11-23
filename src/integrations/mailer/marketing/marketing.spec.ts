import * as fs from 'fs';
import * as path from 'path';
import { mergeFirstName, renderMarketingEmail, safeUrl } from './render';
import { getTemplate, MARKETING_TEMPLATES } from './templates';
import { CampaignContent, ColorSet, RenderContext, TemplateKey } from './types';

const SETS: ColorSet[] = [
  'ink_yellow',
  'yellow_ink',
  'purple_cream',
  'white_purple',
];
const KEYS: TemplateKey[] = [
  'announcement',
  'newsletter',
  'offer',
  'spotlight',
  'comeback',
  'live',
  'letter',
];
const UNSUB = 'https://aiexaminer.app/unsubscribe?token=abc&list=all';
const VIEW = 'https://aiexaminer.app/email/view?id=42&k=x';
const TRACK = 'https://t.aiexaminer.test/c?';
const FIRST_NAME_TOKEN = /\{\s*first[\s_-]*name\s*\}/i;

const tracked = (url: string, label: string) =>
  `${TRACK}u=${encodeURIComponent(url)}&l=${encodeURIComponent(label)}`;

const ctxFor = (over: Partial<RenderContext> = {}): RenderContext => ({
  subject: 'Hello {first name}',
  preheader: 'A note for {first name}',
  firstName: 'Ada',
  trackLink: tracked,
  unsubscribeUrl: UNSUB,
  postalAddress: '12 Example Road, Lagos',
  ...over,
});

const defaults = (key: TemplateKey): CampaignContent =>
  JSON.parse(JSON.stringify(getTemplate(key).defaults));
/** Link targets (<a href>); the font <link> in the head is not a content link. */
const hrefs = (html: string) =>
  [...html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)].map((m) => m[1]);
const unescape = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

describe('marketing template catalog', () => {
  it('has every template once, with the fields the editor always needs', () => {
    expect(MARKETING_TEMPLATES.map((t) => t.key).sort()).toEqual(
      [...KEYS].sort(),
    );
    for (const t of MARKETING_TEMPLATES) {
      expect(t.title).toBeTruthy();
      expect(t.use).toBeTruthy();
      expect(t.defaultSubject).toBeTruthy();
      expect(t.defaultPreheader).toBeTruthy();
      expect(t.fields).toEqual(
        expect.arrayContaining(['colorSet', 'headline', 'body']),
      );
      expect(new Set(t.fields).size).toBe(t.fields.length);
      expect(t.defaults.colorSet).toBeTruthy();
    }
    expect(getTemplate('offer').title).toBe('Offer');
    expect(getTemplate('nope' as TemplateKey)).toBeUndefined();
  });

  it('greets with {first name} in every default body', () => {
    for (const t of MARKETING_TEMPLATES)
      expect(t.defaults.body).toMatch(FIRST_NAME_TOKEN);
  });
});

describe('renderMarketingEmail', () => {
  it.each(KEYS)('renders %s with its defaults', (key) => {
    const t = getTemplate(key);
    const out = renderMarketingEmail(
      key,
      defaults(key),
      ctxFor({ subject: t.defaultSubject, preheader: t.defaultPreheader }),
    );
    expect(out.html.startsWith('<!doctype html>')).toBe(true);
    expect(out.html).toContain('</html>');
    expect(out.html).toContain('Ada');
    expect(out.text).toContain('Ada');
    expect(out.html).not.toMatch(/gradient/i);
    expect(out.html + out.text).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(out.html).not.toMatch(/display:\s*(flex|grid)/i);
    expect(out.text).not.toMatch(/<[a-z][^>]*>/i);
    // headline words show up (the offer headline sits under the big number)
    const firstWord = t.defaults.headline.split(/\s+/)[0];
    expect(out.html).toContain(firstWord);
  });

  it('merges {first name} and its spellings, and falls back to "there"', () => {
    const content: CampaignContent = {
      ...defaults('letter'),
      headline: 'For {First Name}',
      body: 'Hi {first name}, {firstName} / {first_name} / { first name } / {FIRSTNAME}',
      button: { label: 'Go, {first name}', url: 'https://aiexaminer.app/' },
    };
    const named = renderMarketingEmail(
      'letter',
      content,
      ctxFor({ firstName: '  Ada  ' }),
    );
    expect(named.html).toContain('For Ada');
    expect(named.html).toContain('Hi Ada, Ada / Ada / Ada / Ada');
    expect(named.html).toContain('Go, Ada');
    expect(named.text).toContain('Hi Ada, Ada / Ada / Ada / Ada');
    expect(named.html).toContain('<title>Hello Ada</title>');

    for (const firstName of [undefined, null, '', '   ']) {
      const out = renderMarketingEmail(
        'letter',
        content,
        ctxFor({ firstName }),
      );
      expect(out.html).toContain('Hi there, there / there');
      expect(out.text).toContain('Hi there,');
    }
    expect(mergeFirstName('Hi {first name}', 'A$&b')).toBe('Hi A$&b');
  });

  it.each(KEYS)('leaves no {first name} token anywhere in %s', (key) => {
    for (const firstName of ['Ada', null]) {
      const out = renderMarketingEmail(
        key,
        defaults(key),
        ctxFor({ firstName }),
      );
      expect(out.html).not.toMatch(FIRST_NAME_TOKEN);
      expect(out.text).not.toMatch(FIRST_NAME_TOKEN);
    }
  });

  it('escapes a malicious name, headline and content', () => {
    const evil = '<img src=x onerror=alert(1)>';
    for (const key of KEYS) {
      const content = defaults(key);
      content.headline = `<script>alert("x")</script> & ${evil}`;
      content.highlight = '<script>';
      content.subhead = evil;
      content.items = [{ title: evil, text: '"quoted" <b>bold</b>' }];
      content.button = {
        label: evil,
        url: 'https://aiexaminer.app/?a=1&b="2"',
      };
      const out = renderMarketingEmail(
        key,
        content,
        ctxFor({ firstName: '<b onmouseover="x">Eve</b>' }),
      );
      expect(out.html).not.toContain('<script>');
      expect(out.html).not.toContain('<img src=x');
      expect(out.html).not.toContain('<b onmouseover');
      expect(out.html).not.toContain('<b>bold</b>');
      expect(out.html).toContain('&lt;script&gt;');
      expect(out.html).toContain(
        '&lt;b onmouseover=&quot;x&quot;&gt;Eve&lt;/b&gt;',
      );
      for (const h of hrefs(out.html)) expect(h).not.toMatch(/["<>]/);
    }
  });

  it('drops links that are not http(s) or mailto, and completes bare domains', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl(' data:text/html,hi')).toBe('');
    expect(safeUrl('aiexaminer.app/documents')).toBe(
      'https://aiexaminer.app/documents',
    );
    expect(safeUrl('/pricing')).toBe('https://aiexaminer.app/pricing');
    expect(safeUrl('mailto:a@b.c')).toBe('mailto:a@b.c');
    const content = {
      ...defaults('letter'),
      button: { label: 'Click', url: 'javascript:alert(1)' },
    };
    const out = renderMarketingEmail('letter', content, ctxFor());
    expect(out.html).not.toMatch(/javascript:/i);
    expect(out.html).not.toContain('>Click<');
  });

  it.each(KEYS)('sends every content link in %s through trackLink', (key) => {
    const calls: string[] = [];
    const ctx = ctxFor({
      viewInBrowserUrl: VIEW,
      trackLink: (url, label) => {
        calls.push(url);
        return tracked(url, label);
      },
    });
    const out = renderMarketingEmail(key, defaults(key), ctx);
    const links = hrefs(out.html).map(unescape);
    expect(calls.length).toBeGreaterThan(0);
    for (const h of links) {
      if (h === UNSUB || h === VIEW) continue;
      expect(h.startsWith(TRACK)).toBe(true);
    }
    expect(links.filter((h) => h === UNSUB)).toHaveLength(2); // Unsubscribe and Email settings
    expect(links.filter((h) => h === VIEW)).toHaveLength(1);
    expect(links.some((h) => h.startsWith(TRACK))).toBe(true);
    // the plain text carries the tracked links too
    for (const call of calls)
      expect(out.text).toContain(tracked(call, '').split('&l=')[0]);
  });

  it('passes trackLink the label as written, not the personalised one', () => {
    const labels: string[] = [];
    const content = {
      ...defaults('letter'),
      button: { label: 'Go, {first name}', url: 'https://aiexaminer.app/' },
    };
    const out = renderMarketingEmail(
      'letter',
      content,
      ctxFor({ trackLink: (u, l) => (labels.push(l), u) }),
    );
    expect(labels).toEqual(['Go, {first name}']);
    expect(out.html).toContain('>Go, Ada</a>');
  });

  it('omits View in browser when there is no url', () => {
    const out = renderMarketingEmail(
      'announcement',
      defaults('announcement'),
      ctxFor(),
    );
    expect(out.html).not.toContain('View in browser');
    expect(out.text).not.toContain('View in browser');
    const withView = renderMarketingEmail(
      'announcement',
      defaults('announcement'),
      ctxFor({ viewInBrowserUrl: VIEW }),
    );
    expect(withView.html).toContain('View in browser');
    expect(withView.text).toContain(`View in browser: ${VIEW}`);
  });

  it.each(KEYS)(
    'puts the unsubscribe url and postal address in the html and text of %s',
    (key) => {
      const out = renderMarketingEmail(key, defaults(key), ctxFor());
      expect(out.html).toContain(`href="${UNSUB.replace(/&/g, '&amp;')}"`);
      expect(out.html).toContain('12 Example Road, Lagos');
      expect(out.html).toContain(
        'getting this because you have an AI Examiner account.',
      );
      expect(out.html).toContain('Built by Medical students');
      expect(out.text).toContain(UNSUB);
      expect(out.text).toContain('12 Example Road, Lagos');
    },
  );

  it('puts the highlight on the marker only once', () => {
    const content = {
      ...defaults('announcement'),
      headline: 'Read it, read it again',
      highlight: 'read it',
    };
    const out = renderMarketingEmail('announcement', content, ctxFor());
    expect(out.html.match(/class="mark"/g)).toHaveLength(1);
    expect(out.html).toMatch(
      /Read it, <span class="mark"[^>]*>read it<\/span> again/,
    );

    const missing = renderMarketingEmail(
      'announcement',
      { ...content, highlight: 'nowhere' },
      ctxFor(),
    );
    expect(missing.html).not.toContain('class="mark"');
    expect(missing.html).toContain('Read it, read it again');
  });

  it('keeps headline line breaks and sets the second line bold in the spotlight', () => {
    const out = renderMarketingEmail(
      'spotlight',
      defaults('spotlight'),
      ctxFor(),
    );
    expect(out.html).toContain(
      'Meet<br><span style="font-weight:700;">Easy Read</span>',
    );
    expect(out.text).toContain('Meet Easy Read');
  });

  it.each(KEYS)('renders %s in every colour set', (key) => {
    const seen = new Set<string>();
    for (const colorSet of SETS) {
      const out = renderMarketingEmail(
        key,
        { ...defaults(key), colorSet },
        ctxFor(),
      );
      expect(out.html).toContain('</html>');
      expect(out.html).not.toMatch(FIRST_NAME_TOKEN);
      seen.add(out.html);
    }
    expect(seen.size).toBe(SETS.length);
  });

  it('uses the lead colour of the set for the hero', () => {
    const bg = (key: TemplateKey, colorSet: ColorSet) =>
      renderMarketingEmail(key, { ...defaults(key), colorSet }, ctxFor()).html;
    expect(bg('announcement', 'ink_yellow')).toContain('bgcolor="#0e0e10"');
    expect(bg('announcement', 'purple_cream')).toContain('bgcolor="#5b2ad6"');
    expect(bg('offer', 'yellow_ink')).toContain('bgcolor="#f4cb5a"');
    expect(bg('newsletter', 'purple_cream')).toContain('bgcolor="#fbf1cc"');
  });

  it('falls back to a safe colour set and ignores empty optional parts', () => {
    const bare: CampaignContent = {
      colorSet: 'nope' as ColorSet,
      headline: 'Hi',
      body: 'Body',
    };
    for (const key of KEYS) {
      const out = renderMarketingEmail(key, bare, ctxFor());
      expect(out.html).toContain('</html>');
      expect(out.html).not.toContain('undefined');
      expect(out.text).not.toContain('undefined');
    }
  });

  if (process.env.WRITE_PREVIEWS === '1') {
    it('writes previews', () => {
      const dir =
        '/Users/richard/Desktop/aiexaminer/web/redesign/emails/marketing-out';
      fs.mkdirSync(dir, { recursive: true });
      const EXTRA: Record<TemplateKey, ColorSet> = {
        announcement: 'purple_cream',
        newsletter: 'ink_yellow',
        offer: 'ink_yellow',
        spotlight: 'yellow_ink',
        comeback: 'purple_cream',
        live: 'white_purple',
        letter: 'ink_yellow',
      };
      for (const t of MARKETING_TEMPLATES) {
        const ctx = ctxFor({
          subject: t.defaultSubject,
          preheader: t.defaultPreheader,
          firstName: 'Ada',
          trackLink: (url) => url,
          unsubscribeUrl: 'https://aiexaminer.app/unsubscribe?token=preview',
          postalAddress: '[YOUR POSTAL ADDRESS]',
        });
        const main = renderMarketingEmail(t.key, defaults(t.key), ctx);
        fs.writeFileSync(path.join(dir, `${t.key}.html`), main.html);
        fs.writeFileSync(path.join(dir, `${t.key}.txt`), main.text);
        const extra = renderMarketingEmail(
          t.key,
          { ...defaults(t.key), colorSet: EXTRA[t.key] },
          ctx,
        );
        fs.writeFileSync(
          path.join(dir, `${t.key}-${EXTRA[t.key]}.html`),
          extra.html,
        );
      }
    });
  }
});
