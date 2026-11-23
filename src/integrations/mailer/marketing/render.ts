/**
 * Renders a marketing email (HTML plus a plain-text twin) from a template key and its content.
 *
 * Email-safe like the transactional layout (../templates/layout.ts): nested tables, inline
 * styles, `bgcolor` next to every background, no flexbox or grid. One <style> block handles
 * phone widths and a cautious dark mode; a second, separate one crops photos where the client
 * supports object-fit (clients that drop it show the photo uncropped, never stretched).
 *
 * Every content link goes through ctx.trackLink. Unsubscribe, Email settings and View in
 * browser do not.
 */
import { escapeHtml } from '../templates/layout';
import {
  CampaignContent,
  ColorSet,
  ContentItem,
  RenderContext,
  RenderedMarketingEmail,
  TemplateKey,
} from './types';

const FONT = "Lexend, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const SERIF = "'Times New Roman', Times, serif";
const JAKARTA =
  "'Plus Jakarta Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const TEAM = 'The AI Examiner team';

const C = {
  ink: '#0e0e10',
  yellow: '#f4cb5a',
  purple: '#5b2ad6',
  cream: '#fbf1cc',
  page: '#f4f4f6',
  white: '#ffffff',
  body: '#3f3f47',
  muted: '#5c5c65',
  muted2: '#6b6b74',
  line: '#ececef',
  red: '#c8371f',
};

/* ------------------------------------------------------------------ merge fields and links */

const FIRST_NAME = /\{\s*first[\s_-]*name\s*\}/gi;

/** Replaces {first name} ({firstName}, {first_name}, any case, optional spaces) with the name, or "there". */
export function mergeFirstName(
  text: string,
  firstName?: string | null,
): string {
  if (typeof text !== 'string' || !text) return text;
  const name = (firstName ?? '').trim() || 'there';
  return text.replace(FIRST_NAME, () => name);
}

const URL_KEYS = new Set(['url', 'imageUrl', 'calendarUrl']);

function mergeDeep<T>(
  value: T,
  name: string | null | undefined,
  key?: string,
): T {
  if (typeof value === 'string')
    return (key && URL_KEYS.has(key)
      ? value
      : mergeFirstName(value, name)) as unknown as T;
  if (Array.isArray(value))
    return value.map((v) => mergeDeep(v, name)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = mergeDeep(v, name, k);
    return out as unknown as T;
  }
  return value;
}

/** Only http(s) and mailto links; a bare "aiexaminer.app/x" gets https://; anything else is dropped. */
export function safeUrl(raw?: string | null, allowMailto = true): string {
  const url = (raw || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (allowMailto && /^mailto:/i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(url)) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `https://aiexaminer.app${url}`;
  return `https://${url}`;
}

/* ------------------------------------------------------------------ colours */

/** The colours of a template's lead block for one colour set. */
interface Lead {
  bg: string;
  text: string;
  soft: string; // paragraph text on the lead
  muted: string; // small text on the lead (still AA)
  line: string; // hairlines and progress tracks on the lead
  panel: string; // a raised panel on the lead
  accent: string;
  onAccent: string;
  accentText: string; // the accent as text on the lead
  markBg: string;
  markFg: string;
  logoBg: string;
  logoFg: string;
  white: boolean; // lead is white: it follows the card into dark mode
}

const LEADS: Record<ColorSet, Lead> = {
  ink_yellow: {
    bg: C.ink,
    text: C.white,
    soft: '#d9d9de',
    muted: '#b4b4bd',
    line: '#2b2b32',
    panel: '#1c1c21',
    accent: C.yellow,
    onAccent: C.ink,
    accentText: C.yellow,
    markBg: C.yellow,
    markFg: C.ink,
    logoBg: C.purple,
    logoFg: C.white,
    white: false,
  },
  yellow_ink: {
    bg: C.yellow,
    text: C.ink,
    soft: '#3d3210',
    muted: '#3d3210',
    line: '#d4a73a',
    panel: '#f8dc8f',
    accent: C.ink,
    onAccent: C.white,
    accentText: C.ink,
    markBg: C.ink,
    markFg: C.white,
    logoBg: C.purple,
    logoFg: C.white,
    white: false,
  },
  purple_cream: {
    bg: C.purple,
    text: C.white,
    soft: '#ece6ff',
    muted: '#ddd4ff',
    line: '#7a56e2',
    panel: '#4a1fbf',
    accent: C.cream,
    onAccent: C.ink,
    accentText: C.cream,
    markBg: C.cream,
    markFg: C.ink,
    logoBg: C.white,
    logoFg: C.purple,
    white: false,
  },
  white_purple: {
    bg: C.white,
    text: C.ink,
    soft: C.body,
    muted: C.muted,
    line: C.line,
    panel: C.page,
    accent: C.purple,
    onAccent: C.white,
    accentText: C.purple,
    markBg: C.purple,
    markFg: C.white,
    logoBg: C.purple,
    logoFg: C.white,
    white: true,
  },
};

/** The marker on a white background (comeback, newsletter story, letter). */
const MARK_ON_WHITE: Record<ColorSet, { bg: string; fg: string }> = {
  ink_yellow: { bg: C.yellow, fg: C.ink },
  yellow_ink: { bg: C.yellow, fg: C.ink },
  purple_cream: { bg: C.purple, fg: C.white },
  white_purple: { bg: C.purple, fg: C.white },
};

/** The set's colour that reads as text on white (borders may use the lighter `edge`). */
const TONE: Record<ColorSet, { text: string; edge: string }> = {
  ink_yellow: { text: C.ink, edge: C.ink },
  yellow_ink: { text: C.ink, edge: C.yellow },
  purple_cream: { text: C.purple, edge: C.purple },
  white_purple: { text: C.purple, edge: C.purple },
};

/** Newsletter masthead: purple_cream keeps the approved cream masthead with purple pops. */
const MASTHEAD: Record<
  ColorSet,
  {
    bg: string;
    text: string;
    rule: string;
    tagline: string;
    issue: string;
    white: boolean;
  }
> = {
  purple_cream: {
    bg: C.cream,
    text: C.ink,
    rule: C.ink,
    tagline: '#3d3210',
    issue: '#5c4a14',
    white: false,
  },
  ink_yellow: {
    bg: C.ink,
    text: C.white,
    rule: C.yellow,
    tagline: '#d9d9de',
    issue: '#b4b4bd',
    white: false,
  },
  yellow_ink: {
    bg: C.yellow,
    text: C.ink,
    rule: C.ink,
    tagline: '#3d3210',
    issue: '#3d3210',
    white: false,
  },
  white_purple: {
    bg: C.white,
    text: C.ink,
    rule: C.purple,
    tagline: C.body,
    issue: C.muted,
    white: true,
  },
};

/** Offer deadline bar: the accent, with the note in the lead colour (yellow when the lead is white). */
const offerBar = (set: ColorSet) => {
  const l = LEADS[set];
  return { bg: l.accent, text: l.onAccent, note: l.white ? C.yellow : l.bg };
};

/** Letter button. */
const LETTER_BUTTON: Record<ColorSet, { bg: string; fg: string }> = {
  ink_yellow: { bg: C.ink, fg: C.white },
  yellow_ink: { bg: C.yellow, fg: C.ink },
  purple_cream: { bg: C.purple, fg: C.white },
  white_purple: { bg: C.purple, fg: C.white },
};

/* ------------------------------------------------------------------ small html helpers */

const esc = (s: unknown): string => escapeHtml(s == null ? '' : String(s));
const cls = (...names: (string | false | undefined)[]) => {
  const list = names.filter(Boolean).join(' ');
  return list ? ` class="${list}"` : '';
};

/** Paragraphs split on blank lines; single line breaks are kept. */
const paragraphs = (text?: string): string[] =>
  (text || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

const lines = (text: string) => esc(text).replace(/\r?\n/g, '<br>');

function paragraphsHtml(
  text: string,
  style: string,
  className?: string,
  gap = 14,
): string {
  const list = paragraphs(text);
  return list
    .map(
      (p, i) =>
        `<p${cls(className)} style="margin:0 0 ${i === list.length - 1 ? 0 : gap}px;font-family:${FONT};${style}">${lines(p)}</p>`,
    )
    .join('\n');
}

const textParagraphs = (text?: string) => paragraphs(text).join('\n\n');

/**
 * The headline: escaped, line breaks kept, the first occurrence of `highlight` on the marker.
 * In the light display headlines (`boldAfterBreak`), the lines after the first are bold, as in
 * the approved "Meet / Easy Read" design.
 */
export function headlineHtml(
  text: string,
  highlight: string | undefined,
  mark: { bg: string; fg: string; pad?: number },
  boldAfterBreak = false,
): string {
  const hl = (highlight || '').trim();
  let marked = false;
  return (text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line, i) => {
      let inner = esc(line);
      if (!marked && hl) {
        let at = line.indexOf(hl);
        if (at < 0) at = line.toLowerCase().indexOf(hl.toLowerCase());
        if (at >= 0) {
          marked = true;
          const span = `<span class="mark" style="background:${mark.bg};color:${mark.fg};font-weight:700;padding:0 ${mark.pad ?? 10}px;border-radius:6px;-webkit-box-decoration-break:clone;box-decoration-break:clone;">${esc(line.slice(at, at + hl.length))}</span>`;
          inner =
            esc(line.slice(0, at)) + span + esc(line.slice(at + hl.length));
        }
      }
      return boldAfterBreak && i > 0
        ? `<span style="font-weight:700;">${inner}</span>`
        : inner;
    })
    .join('<br>');
}

const headlineText = (text: string) =>
  (text || '').replace(/\s*\r?\n\s*/g, ' ').trim();

interface ButtonOpts {
  href: string;
  label: string;
  bg: string;
  fg: string;
  size?: 'lg' | 'md' | 'sm';
  inkClass?: boolean;
}

const BUTTON_SIZE = {
  lg: { pad: '18px 34px', font: 16 },
  md: { pad: '14px 24px', font: 15 },
  sm: { pad: '12px 22px', font: 14 },
};

function buttonHtml(o: ButtonOpts): string {
  const s = BUTTON_SIZE[o.size || 'lg'];
  const k = o.inkClass ? 'btn-ink' : undefined;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
  <tr>
    <td align="center" bgcolor="${o.bg}"${cls(k)} style="background:${o.bg};border-radius:999px;mso-padding-alt:${s.pad};">
      <a href="${esc(o.href)}" target="_blank"${cls(k)} style="display:inline-block;padding:${s.pad};font-family:${FONT};font-size:${s.font}px;font-weight:600;line-height:20px;color:${o.fg};text-decoration:none;border-radius:999px;">${esc(o.label)}</a>
    </td>
  </tr>
</table>`;
}

function logoHtml(
  bg: string,
  fg: string,
  word: string,
  wordClass?: string,
): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
  <tr>
    <td width="28" height="28" align="center" valign="middle" bgcolor="${bg}" style="width:28px;height:28px;background:${bg};border-radius:8px;font-family:${FONT};font-size:12px;font-weight:700;line-height:28px;color:${fg};">AI</td>
    <td${cls(wordClass)} style="padding-left:9px;font-family:${FONT};font-size:17px;font-weight:600;line-height:22px;letter-spacing:-0.01em;color:${word};">Examiner</td>
  </tr>
</table>`;
}

/** Logo on the left; on the right, optional extra html and "View in browser" when there is a url. */
function headerHtml(
  ctx: RenderContext,
  logo: string,
  view: { color: string; className?: string },
  right = '',
): string {
  const viewUrl = safeUrl(ctx.viewInBrowserUrl, false);
  const viewLink = viewUrl
    ? `<a href="${esc(viewUrl)}" target="_blank"${cls(view.className)} style="font-family:${FONT};font-size:12px;line-height:18px;color:${view.color};text-decoration:underline;">View in browser</a>`
    : '';
  const side = [right, viewLink].filter(Boolean).join('<br>');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td valign="middle">${logo}</td>
    ${side ? `<td align="right" valign="middle" style="font-family:${FONT};font-size:12px;line-height:18px;">${side}</td>` : ''}
  </tr>
</table>`;
}

/** One full-width section of the card. */
function section(
  inner: string,
  pad: string,
  opts: { bg?: string; className?: string; style?: string } = {},
): string {
  const bg = opts.bg ? ` bgcolor="${opts.bg}"` : '';
  const bgStyle = opts.bg ? `background:${opts.bg};` : '';
  return `<tr>
  <td${cls('px', opts.className)}${bg} style="padding:${pad};${bgStyle}${opts.style || ''}">
${inner}
  </td>
</tr>`;
}

function signoffHtml(signoff: string | undefined, topMargin: number): string {
  if (!signoff || !signoff.trim()) return '';
  return `<p class="body" style="margin:${topMargin}px 0 0;font-family:${FONT};font-size:15px;line-height:24px;color:${C.body};">${lines(signoff.trim())}<br><b class="ink" style="font-weight:600;color:${C.ink};">${TEAM}</b></p>`;
}

function imageHtml(
  c: CampaignContent,
  width: number,
  crop: string,
  radius = 0,
): string {
  const src = safeUrl(c.imageUrl, false);
  if (!src) return '';
  return `<img src="${esc(src)}" width="${width}" alt="${esc(c.imageAlt || '')}" class="img-fluid ${crop}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;outline:none;text-decoration:none;${radius ? `border-radius:${radius}px;` : ''}">`;
}

const zeroPad = (i: number) => String(i + 1).padStart(2, '0');

const items = (c: CampaignContent): ContentItem[] =>
  (c.items || []).filter(
    (it) => it && ((it.title || '').trim() || (it.text || '').trim()),
  );

/* ------------------------------------------------------------------ rendering context */

interface Kit {
  /** Content with {first name} merged in. */
  c: CampaignContent;
  /** Content as written: link labels for trackLink come from here, so they are the same for every recipient. */
  raw: CampaignContent;
  ctx: RenderContext;
  set: ColorSet;
  lead: Lead;
  /** Tracked href for a content link, or '' when the url is missing or unsafe. */
  link: (url: string | undefined, label: string) => string;
  /** Plain-text lines. */
  text: string[];
}

interface Body {
  rows: string;
  /** Card background when the whole card is the lead colour (live). */
  cardBg?: string;
  cardWhite?: boolean;
}

/** Lead-block helpers: classes so a white lead follows the card into dark mode. */
const leadCls = (l: Lead) => ({
  block: l.white ? 'card' : undefined,
  text: l.white ? 'ink' : undefined,
  soft: l.white ? 'body' : undefined,
  muted: l.white ? 'muted' : undefined,
  panel: l.white ? 'panel' : undefined,
});

function textButton(k: Kit, label: string, href: string) {
  if (href) k.text.push(`${label}: ${href}`, '');
}

function textItems(
  k: Kit,
  list: ContentItem[],
  numbered: 'pad' | 'plain' | 'none' | 'time',
) {
  list.forEach((it, i) => {
    const title = (it.title || '').trim();
    const t = (it.text || '').trim();
    if (numbered === 'time') k.text.push(`${title}  ${t}`.trim());
    else {
      const n =
        numbered === 'pad'
          ? `${zeroPad(i)}  `
          : numbered === 'plain'
            ? `${i + 1}. `
            : '- ';
      k.text.push(`${n}${title}`);
      if (t) k.text.push(`    ${t}`);
    }
  });
  if (list.length) k.text.push('');
}

/* ------------------------------------------------------------------ templates */

function announcement(k: Kit): Body {
  const { c, lead } = k;
  const lc = leadCls(lead);
  const rows: string[] = [];

  rows.push(
    section(
      headerHtml(
        k.ctx,
        logoHtml(lead.logoBg, lead.logoFg, lead.text, lc.text),
        { color: lead.muted, className: lc.muted },
      ),
      '22px 36px',
      { bg: lead.bg, className: lc.block },
    ),
  );
  rows.push(
    section(
      `<h1${cls('fs-60', lc.text)} style="margin:0;font-family:${FONT};font-size:60px;line-height:62px;font-weight:300;letter-spacing:-0.035em;color:${lead.text};mso-line-height-rule:exactly;">${headlineHtml(c.headline, c.highlight, { bg: lead.markBg, fg: lead.markFg }, true)}</h1>
${c.subhead ? `<p${cls(lc.soft)} style="margin:24px 0 0;max-width:430px;font-family:${FONT};font-size:17px;line-height:27px;font-weight:300;color:${lead.soft};">${lines(c.subhead)}</p>` : ''}`,
      '34px 36px 52px',
      { bg: lead.bg, className: lc.block },
    ),
  );
  const img = imageHtml(c, 600, 'crop-340');
  if (img)
    rows.push(
      `<tr><td style="padding:0;font-size:0;line-height:0;">${img}</td></tr>`,
    );

  rows.push(
    section(
      paragraphsHtml(
        c.body,
        `font-size:17px;line-height:28px;color:${C.body};`,
        'body',
      ),
      '44px 36px 8px',
    ),
  );

  const list = items(c);
  if (list.length) {
    rows.push(
      section(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${list
  .map((it, i) => {
    const border =
      i < list.length - 1 ? `border-bottom:1px solid ${C.line};` : '';
    return `<tr>
  <td width="64" valign="top" class="numcol rule" style="width:64px;padding:22px 0;${border}font-family:${FONT};font-size:40px;line-height:40px;font-weight:300;letter-spacing:-0.03em;color:${C.purple};"><span class="tone-num">${zeroPad(i)}</span></td>
  <td valign="top" class="numgap rule" style="padding:22px 0 22px 22px;${border}font-family:${FONT};">
    <p class="ink" style="margin:0;font-size:19px;line-height:25px;font-weight:600;letter-spacing:-0.01em;color:${C.ink};">${esc(it.title)}</p>
    ${it.text ? `<p class="muted" style="margin:6px 0 0;font-size:15px;line-height:24px;color:${C.muted};">${lines(it.text)}</p>` : ''}
  </td>
</tr>`;
  })
  .join('\n')}
</table>`,
        '20px 36px 0',
      ),
    );
  }

  const href = c.button
    ? k.link(c.button.url, k.raw.button?.label || c.button.label)
    : '';
  const cta = href
    ? buttonHtml({
        href,
        label: c.button.label,
        bg: C.ink,
        fg: C.white,
        inkClass: true,
      })
    : '';
  const sign = signoffHtml(c.signoff, cta ? 34 : 0);
  if (cta || sign) rows.push(section(`${cta}\n${sign}`, '18px 36px 48px'));
  else rows.push(section('', '0 36px 40px'));

  // text
  k.text.push(headlineText(c.headline), '');
  if (c.subhead) k.text.push(c.subhead, '');
  k.text.push(textParagraphs(c.body), '');
  textItems(k, list, 'pad');
  if (href) textButton(k, c.button.label, href);
  return { rows: rows.join('\n') };
}

function newsletter(k: Kit): Body {
  const { c, set } = k;
  const m = MASTHEAD[set];
  const mc = {
    block: m.white ? 'card' : undefined,
    text: m.white ? 'ink' : undefined,
    soft: m.white ? 'body' : undefined,
    muted: m.white ? 'muted' : undefined,
  };
  const rows: string[] = [];

  const issue = c.issueLabel
    ? `<span${cls(mc.muted)} style="font-family:${FONT};font-size:12.5px;line-height:18px;color:${m.issue};">${esc(c.issueLabel)}</span>`
    : '';
  rows.push(
    section(
      `${headerHtml(k.ctx, logoHtml(C.purple, C.white, m.text, mc.text), { color: m.issue, className: mc.muted }, issue)}
<h1${cls('fs-84', mc.text)} style="margin:46px 0 0;font-family:${FONT};font-size:84px;line-height:80px;font-weight:300;letter-spacing:-0.05em;color:${m.text};mso-line-height-rule:exactly;">Study<br><span style="font-weight:700;">notes</span></h1>
<p${cls(mc.soft)} style="margin:18px 0 0;padding-top:16px;border-top:1.5px solid ${m.rule};font-family:${FONT};font-size:15px;line-height:23px;color:${m.tagline};">Tips, new features and one good idea for your revision this month.</p>`,
      '26px 36px 34px',
      {
        bg: m.bg,
        className: mc.block,
        style: m.white ? `border-bottom:1px solid ${C.line};` : '',
      },
    ),
  );

  if (paragraphs(c.body).length)
    rows.push(
      section(
        paragraphsHtml(
          c.body,
          `font-size:16.5px;line-height:27px;color:${C.body};`,
          'body',
        ),
        '36px 36px 10px',
      ),
    );

  const mark = MARK_ON_WHITE[set];
  const img = imageHtml(c, 528, 'crop-300', 4);
  rows.push(
    section(
      `${img}
<h2${cls('ink', 'fs-30')} style="margin:${img ? 22 : 0}px 0 0;font-family:${FONT};font-size:30px;line-height:34px;font-weight:600;letter-spacing:-0.025em;color:${C.ink};">${headlineHtml(c.headline, c.highlight, { ...mark, pad: 8 })}</h2>
${c.subhead ? `<p class="muted" style="margin:12px 0 0;font-family:${FONT};font-size:15.5px;line-height:26px;color:${C.muted};">${lines(c.subhead)}</p>` : ''}`,
      '24px 36px 8px',
    ),
  );

  const list = items(c);
  if (list.length) {
    rows.push(
      section(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${list
  .map(
    (it, i) => `<tr>
  <td width="44" valign="top" class="rule" style="width:44px;padding:18px 0;border-top:1px solid ${C.line};font-family:${FONT};font-size:30px;line-height:30px;font-weight:300;letter-spacing:-0.03em;color:${C.purple};"><span class="tone-num">${zeroPad(i)}</span></td>
  <td valign="top" class="rule" style="padding:18px 0 18px 20px;border-top:1px solid ${C.line};font-family:${FONT};">
    <p class="ink" style="margin:0;font-size:17px;line-height:23px;font-weight:600;color:${C.ink};">${esc(it.title)}</p>
    ${it.text ? `<p class="muted" style="margin:4px 0 0;font-size:14.5px;line-height:23px;color:${C.muted};">${lines(it.text)}</p>` : ''}
  </td>
</tr>`,
  )
  .join('\n')}
</table>`,
        '18px 36px 0',
      ),
    );
  }

  if (c.quote && (c.quote.text || '').trim()) {
    rows.push(
      section(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
  <tr>
    <td bgcolor="${C.ink}" style="background:${C.ink};border-radius:4px;padding:30px 30px 26px;font-family:${FONT};">
      <p aria-hidden="true" style="margin:0;font-family:Georgia, 'Times New Roman', serif;font-size:64px;line-height:38px;height:30px;color:${C.yellow};">&ldquo;</p>
      <p style="margin:18px 0 0;font-size:22px;line-height:31px;font-weight:300;letter-spacing:-0.01em;color:${C.white};">${lines(c.quote.text)}</p>
      ${c.quote.by ? `<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:#b4b4bd;">${esc(c.quote.by)}</p>` : ''}
    </td>
  </tr>
</table>`,
        '26px 36px 0',
      ),
    );
  }

  const rawCards = k.raw.cards || [];
  const cards = (c.cards || [])
    .map(
      (cd, i) =>
        cd && {
          ...cd,
          rawLabel:
            (rawCards[i] && (rawCards[i].linkLabel || rawCards[i].title)) || '',
        },
    )
    .filter((cd) => cd && (cd.title || cd.text));
  const CARD = [
    { bg: C.yellow, title: C.ink, text: C.ink, link: C.ink },
    { bg: C.purple, title: C.white, text: '#ece6ff', link: C.white },
  ];
  const cardTexts: string[] = [];
  if (cards.length) {
    const cell = (cd: (typeof cards)[number], i: number, width: string) => {
      const col = CARD[i % CARD.length];
      const href = k.link(cd.url, cd.rawLabel || cd.linkLabel || cd.title);
      if (href)
        cardTexts.push(
          `${cd.title}: ${cd.text}`.trim(),
          `${cd.linkLabel || 'Open'}: ${href}`,
          '',
        );
      else cardTexts.push(`${cd.title}: ${cd.text}`.trim(), '');
      return `<td valign="top" width="${width}" bgcolor="${col.bg}" class="stack card-cell" style="width:${width};background:${col.bg};border-radius:4px;padding:22px 20px;font-family:${FONT};">
      <p style="margin:0;font-size:18px;line-height:24px;font-weight:600;letter-spacing:-0.01em;color:${col.title};">${esc(cd.title)}</p>
      ${cd.text ? `<p style="margin:8px 0 0;font-size:14px;line-height:22px;color:${col.text};">${lines(cd.text)}</p>` : ''}
      ${href ? `<p style="margin:14px 0 0;font-size:14px;line-height:20px;"><a href="${esc(href)}" target="_blank" style="font-weight:600;color:${col.link};text-decoration:underline;">${esc(cd.linkLabel || 'Read more')}</a></p>` : ''}
    </td>`;
    };
    const pairs: string[] = [];
    for (let i = 0; i < cards.length; i += 2) {
      const pair = cards.slice(i, i + 2);
      const top =
        i === 0
          ? ''
          : '<tr><td colspan="3" height="12" style="height:12px;font-size:0;line-height:0;">&nbsp;</td></tr>';
      pairs.push(
        pair.length === 2
          ? `${top}<tr>
    ${cell(pair[0], i, '49%')}
    <td width="2%" class="stack-gap" style="width:2%;font-size:0;line-height:0;">&nbsp;</td>
    ${cell(pair[1], i + 1, '49%')}
  </tr>`
          : `${top}<tr>
    ${cell(pair[0], i, '100%').replace('<td ', '<td colspan="3" ')}
  </tr>`,
      );
    }
    rows.push(
      section(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
  ${pairs.join('\n')}
</table>`,
        '26px 36px 0',
      ),
    );
  }

  const href = c.button
    ? k.link(c.button.url, k.raw.button?.label || c.button.label)
    : '';
  const cta = href
    ? buttonHtml({
        href,
        label: c.button.label,
        bg: C.ink,
        fg: C.white,
        inkClass: true,
      })
    : '';
  rows.push(
    section(
      `${cta}\n${signoffHtml(c.signoff, cta ? 30 : 0)}`,
      '36px 36px 48px',
    ),
  );

  // text
  k.text.push(
    `STUDY NOTES${c.issueLabel ? `  ·  ${c.issueLabel}` : ''}`,
    'Tips, new features and one good idea for your revision this month.',
    '',
  );
  if (paragraphs(c.body).length) k.text.push(textParagraphs(c.body), '');
  k.text.push(headlineText(c.headline), '');
  if (c.subhead) k.text.push(c.subhead, '');
  textItems(k, list, 'pad');
  if (c.quote && c.quote.text)
    k.text.push(`“${c.quote.text}”${c.quote.by ? ` (${c.quote.by})` : ''}`, '');
  k.text.push(...cardTexts);
  if (href) textButton(k, c.button.label, href);
  return { rows: rows.join('\n') };
}

function offer(k: Kit): Body {
  const { c, lead, set } = k;
  const lc = leadCls(lead);
  const o = c.offer || ({} as CampaignContent['offer']);
  const line = (c.headline || '').trim() ? c.headline : o.line || '';
  const bar = offerBar(set);
  const rows: string[] = [];

  rows.push(
    section(
      `${headerHtml(k.ctx, logoHtml(lead.logoBg, lead.logoFg, lead.text, lc.text), { color: lead.muted, className: lc.muted })}
${o.intro ? `<p${cls(lc.text)} style="margin:44px 0 0;font-family:${FONT};font-size:20px;line-height:26px;font-weight:500;letter-spacing:-0.01em;color:${lead.text};">${esc(o.intro)}</p>` : ''}
${o.big ? `<p${cls('fs-190', lc.text)} style="margin:${o.intro ? 4 : 40}px 0 0;font-family:${FONT};font-size:190px;line-height:164px;font-weight:800;letter-spacing:-0.07em;color:${lead.text};mso-line-height-rule:exactly;">${esc(o.big)}</p>` : ''}
<h1${cls('fs-34', lc.text)} style="margin:10px 0 0;font-family:${FONT};font-size:34px;line-height:38px;font-weight:300;letter-spacing:-0.03em;color:${lead.text};">${headlineHtml(line, c.highlight, { bg: lead.markBg, fg: lead.markFg, pad: 8 })}</h1>`,
      '24px 36px 40px',
      { bg: lead.bg, className: lc.block },
    ),
  );

  if (o.deadline || o.deadlineNote) {
    rows.push(
      section(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td valign="middle" style="font-family:${FONT};font-size:14px;line-height:21px;color:${bar.text};">${esc(o.deadline || '')}</td>
    ${o.deadlineNote ? `<td align="right" valign="middle" style="padding-left:16px;white-space:nowrap;font-family:${FONT};font-size:14px;line-height:21px;font-weight:600;color:${bar.note};">${esc(o.deadlineNote)}</td>` : ''}
  </tr>
</table>`,
        '16px 36px',
        { bg: bar.bg },
      ),
    );
  }

  rows.push(
    section(
      paragraphsHtml(
        c.body,
        `font-size:17px;line-height:28px;color:${C.body};`,
        'body',
      ),
      '40px 36px 10px',
    ),
  );

  const list = items(c);
  if (list.length) {
    const title = (c.itemsTitle || '').trim() || 'What you get';
    rows.push(
      section(
        `<h2 class="muted" style="margin:0 0 6px;font-family:${FONT};font-size:13px;line-height:20px;font-weight:600;color:${C.muted};">${esc(title)}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${list
  .map(
    (it) => `<tr>
  <td width="24" valign="top" class="rule" style="width:24px;padding:14px 0;border-bottom:1px solid ${C.line};">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr>
      <td width="24" height="24" align="center" valign="middle" aria-hidden="true" bgcolor="${C.purple}" style="width:24px;height:24px;background:${C.purple};border-radius:999px;font-family:${FONT};font-size:12px;font-weight:700;line-height:24px;color:${C.white};">&#10003;</td>
    </tr></table>
  </td>
  <td valign="top" class="rule" style="padding:14px 0 14px 14px;border-bottom:1px solid ${C.line};font-family:${FONT};">
    <p class="ink" style="margin:0;font-size:16px;line-height:24px;color:${C.ink};">${esc(it.title)}</p>
    ${it.text ? `<p class="muted" style="margin:2px 0 0;font-size:14px;line-height:21px;color:${C.muted};">${lines(it.text)}</p>` : ''}
  </td>
</tr>`,
  )
  .join('\n')}
</table>`,
        '22px 36px 0',
      ),
    );
  }

  if (o.code) {
    rows.push(
      section(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
  <tr>
    <td class="code-box" style="border:2px dashed ${C.ink};border-radius:6px;padding:18px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td valign="middle" class="stack body" style="font-family:${FONT};font-size:14px;line-height:21px;color:${C.body};">Your code, added at checkout</td>
          <td align="right" valign="middle" class="stack code-cell ink" style="padding-left:12px;font-family:${FONT};font-size:24px;line-height:30px;font-weight:700;letter-spacing:0.06em;color:${C.ink};white-space:nowrap;">${esc(o.code)}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
        '30px 36px 0',
      ),
    );
  }

  const href = c.button
    ? k.link(c.button.url, k.raw.button?.label || c.button.label)
    : '';
  const cta = href
    ? buttonHtml({ href, label: c.button.label, bg: C.purple, fg: C.white })
    : '';
  const fine = o.fineprint
    ? `<p class="muted" style="margin:${cta ? 18 : 0}px 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted2};">${lines(o.fineprint)}</p>`
    : '';
  rows.push(section(`${cta}\n${fine}`, '32px 36px 48px'));

  // text
  k.text.push(
    [o.intro, [o.big, headlineText(line)].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(': '),
    '',
  );
  if (o.deadline || o.deadlineNote)
    k.text.push([o.deadline, o.deadlineNote].filter(Boolean).join(' · '), '');
  k.text.push(textParagraphs(c.body), '');
  if (list.length) {
    k.text.push((c.itemsTitle || '').trim() || 'What you get');
    textItems(k, list, 'none');
  }
  if (o.code) k.text.push(`Your code, added at checkout: ${o.code}`, '');
  if (href) textButton(k, c.button.label, href);
  if (o.fineprint) k.text.push(o.fineprint, '');
  return { rows: rows.join('\n') };
}

function spotlight(k: Kit): Body {
  const { c, lead, set } = k;
  const lc = leadCls(lead);
  const tone = TONE[set];
  const rows: string[] = [];

  rows.push(
    section(
      `${headerHtml(k.ctx, logoHtml(lead.logoBg, lead.logoFg, lead.text, lc.text), { color: lead.muted, className: lc.muted })}
<h1${cls('fs-66', lc.text)} style="margin:48px 0 0;font-family:${FONT};font-size:66px;line-height:66px;font-weight:300;letter-spacing:-0.045em;color:${lead.text};mso-line-height-rule:exactly;">${headlineHtml(c.headline, c.highlight, { bg: lead.markBg, fg: lead.markFg }, true)}</h1>
${c.subhead ? `<p${cls(lc.soft)} style="margin:20px 0 0;max-width:420px;font-family:${FONT};font-size:17px;line-height:27px;font-weight:300;color:${lead.soft};">${lines(c.subhead)}</p>` : ''}`,
      '24px 36px 46px',
      { bg: lead.bg, className: lc.block },
    ),
  );

  if (paragraphs(c.body).length)
    rows.push(
      section(
        paragraphsHtml(
          c.body,
          `font-size:17px;line-height:28px;color:${C.body};`,
          'body',
        ),
        '40px 36px 6px',
      ),
    );

  const ba = c.beforeAfter;
  if (ba && (ba.before || ba.after)) {
    rows.push(
      section(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
  <tr>
    <td bgcolor="#fbfbfc" class="panel rule" style="background:#fbfbfc;border:1px solid ${C.line};border-radius:6px;padding:20px 22px;">
      <p class="muted" style="margin:0 0 10px;font-family:${FONT};font-size:12.5px;line-height:18px;font-weight:600;color:${C.muted2};">Your lecture notes</p>
      <p class="ink" style="margin:0;font-family:${SERIF};font-size:16px;line-height:25px;color:#1d1d22;">${lines(ba.before)}</p>
    </td>
  </tr>
  <tr>
    <td align="center" aria-hidden="true" class="tone" style="padding:12px 0;font-family:Arial, Helvetica, sans-serif;font-size:22px;line-height:22px;font-weight:700;color:${tone.text};">&#8595;</td>
  </tr>
  <tr>
    <td bgcolor="${C.white}" class="card tone-border" style="background:${C.white};border:2px solid ${tone.edge};border-radius:6px;padding:20px 22px;">
      <p class="tone" style="margin:0 0 10px;font-family:${FONT};font-size:12.5px;line-height:18px;font-weight:600;color:${tone.text};">Easy Read</p>
      <p class="body" style="margin:0;font-family:${JAKARTA};font-size:15.5px;line-height:26px;color:#33333b;">${lines(ba.after)}</p>
    </td>
  </tr>
</table>`,
        '20px 36px 0',
      ),
    );
  }

  const list = items(c);
  const STEP = [
    { bg: C.yellow, fg: C.ink },
    { bg: C.purple, fg: C.white },
    { bg: C.ink, fg: C.white },
  ];
  if (list.length) {
    const title = (c.itemsTitle || '').trim() || 'How to try it';
    rows.push(
      section(
        `<h2 class="ink" style="margin:0 0 6px;font-family:${FONT};font-size:26px;line-height:30px;font-weight:600;letter-spacing:-0.02em;color:${C.ink};">${esc(title)}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${list
  .map((it, i) => {
    const s = STEP[i % STEP.length];
    const border = `border-bottom:1px solid ${C.line};`;
    return `<tr>
  <td width="40" valign="top" class="rule" style="width:40px;padding:18px 0;${border}">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr>
      <td width="40" height="40" align="center" valign="middle" bgcolor="${s.bg}" style="width:40px;height:40px;background:${s.bg};border-radius:999px;font-family:${FONT};font-size:16px;font-weight:700;line-height:40px;color:${s.fg};">${i + 1}</td>
    </tr></table>
  </td>
  <td valign="top" class="rule" style="padding:20px 0 18px 18px;${border}font-family:${FONT};">
    <p class="ink" style="margin:0;font-size:17px;line-height:23px;font-weight:600;color:${C.ink};">${esc(it.title)}</p>
    ${it.text ? `<p class="muted" style="margin:4px 0 0;font-size:14.5px;line-height:23px;color:${C.muted};">${lines(it.text)}</p>` : ''}
  </td>
</tr>`;
  })
  .join('\n')}
</table>`,
        '34px 36px 0',
      ),
    );
  }

  const href = c.button
    ? k.link(c.button.url, k.raw.button?.label || c.button.label)
    : '';
  const cta = href
    ? buttonHtml({
        href,
        label: c.button.label,
        bg: C.ink,
        fg: C.white,
        inkClass: true,
      })
    : '';
  rows.push(
    section(
      `${cta}\n${signoffHtml(c.signoff, cta ? 30 : 0)}`,
      '34px 36px 48px',
    ),
  );

  // text
  k.text.push(headlineText(c.headline), '');
  if (c.subhead) k.text.push(c.subhead, '');
  if (paragraphs(c.body).length) k.text.push(textParagraphs(c.body), '');
  if (ba && ba.before) k.text.push('Your lecture notes:', ba.before, '');
  if (ba && ba.after) k.text.push('Easy Read:', ba.after, '');
  if (list.length) {
    k.text.push((c.itemsTitle || '').trim() || 'How to try it');
    textItems(k, list, 'plain');
  }
  if (href) textButton(k, c.button.label, href);
  return { rows: rows.join('\n') };
}

function comeback(k: Kit): Body {
  const { c, lead, set } = k;
  const rows: string[] = [];
  const mark = MARK_ON_WHITE[set];

  rows.push(
    section(
      headerHtml(k.ctx, logoHtml(C.purple, C.white, C.ink, 'ink'), {
        color: C.muted2,
        className: 'muted',
      }),
      '24px 36px',
    ),
  );
  rows.push(
    section(
      `<h1 class="ink fs-54" style="margin:0;font-family:${FONT};font-size:54px;line-height:56px;font-weight:300;letter-spacing:-0.04em;color:${C.ink};mso-line-height-rule:exactly;">${headlineHtml(c.headline, c.highlight, { ...mark, pad: 8 }, true)}</h1>
${paragraphs(c.body).length ? `<div style="margin:26px 0 0;">${paragraphsHtml(c.body, `font-size:17px;line-height:28px;color:${C.body};`, 'body')}</div>` : ''}`,
      '28px 36px 0',
    ),
  );

  const r = c.resume;
  const rawResume = k.raw.resume;
  const resumeHref = r
    ? k.link(
        r.url,
        (rawResume && (rawResume.buttonLabel || rawResume.title)) ||
          r.buttonLabel ||
          r.title,
      )
    : '';
  if (r && (r.title || r.subtitle)) {
    // A white lead becomes a light grey panel so the card still reads as a card.
    const card = lead.white
      ? {
          bg: C.page,
          text: C.ink,
          muted: C.muted,
          track: '#dcdce0',
          cls: 'panel',
          tcls: 'ink',
          mcls: 'muted',
        }
      : {
          bg: lead.bg,
          text: lead.text,
          muted: lead.muted,
          track: lead.line,
          cls: undefined,
          tcls: undefined,
          mcls: undefined,
        };
    const pct =
      typeof r.progress === 'number' && isFinite(r.progress)
        ? Math.max(0, Math.min(100, Math.round(r.progress)))
        : null;
    const bar =
      pct === null
        ? ''
        : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 0;border-collapse:separate;">
  <tr>
    <td height="8" bgcolor="${card.track}" style="height:8px;background:${card.track};border-radius:999px;font-size:0;line-height:0;">
      ${
        pct > 0
          ? `<table role="presentation" width="${pct}%" cellpadding="0" cellspacing="0" border="0" style="width:${pct}%;border-collapse:separate;"><tr><td height="8" bgcolor="${lead.accent}" style="height:8px;background:${lead.accent};border-radius:999px;font-size:0;line-height:0;">&nbsp;</td></tr></table>`
          : '&nbsp;'
      }
    </td>
  </tr>
</table>`;
    rows.push(
      section(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
  <tr>
    <td bgcolor="${card.bg}"${cls(card.cls)} style="background:${card.bg};border-radius:6px;padding:24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="44" valign="middle" style="width:44px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr>
              <td width="44" height="54" align="center" valign="middle" bgcolor="${C.white}" style="width:44px;height:54px;background:${C.white};border-radius:6px;font-family:${FONT};font-size:10px;line-height:12px;font-weight:800;letter-spacing:0.04em;color:${C.red};">PDF</td>
            </tr></table>
          </td>
          <td valign="middle" style="padding-left:14px;font-family:${FONT};">
            <p${cls(card.tcls)} style="margin:0;font-size:18px;line-height:24px;font-weight:600;letter-spacing:-0.01em;color:${card.text};">${esc(r.title)}</p>
            ${r.subtitle ? `<p${cls(card.mcls)} style="margin:3px 0 0;font-size:13.5px;line-height:20px;color:${card.muted};">${esc(r.subtitle)}</p>` : ''}
          </td>
        </tr>
      </table>
      ${bar}
      ${resumeHref ? `<div style="margin:14px 0 0;">${buttonHtml({ href: resumeHref, label: r.buttonLabel || 'Pick up where you left off', bg: lead.accent, fg: lead.onAccent, size: 'md' })}</div>` : ''}
    </td>
  </tr>
</table>`,
        '32px 36px 0',
      ),
    );
  }

  const list = items(c);
  if (list.length) {
    const title = (c.itemsTitle || '').trim() || 'New since you were here';
    rows.push(
      section(
        `<h2 class="ink" style="margin:0 0 4px;font-family:${FONT};font-size:24px;line-height:29px;font-weight:600;letter-spacing:-0.02em;color:${C.ink};">${esc(title)}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${list
  .map((it) => {
    const border = `border-bottom:1px solid ${C.line};`;
    return `<tr>
  <td width="10" valign="top" class="rule" style="width:10px;padding:23px 0 16px;${border}">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr>
      <td width="10" height="10" bgcolor="${C.purple}" style="width:10px;height:10px;background:${C.purple};border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td>
  <td valign="top" class="rule" style="padding:16px 0 16px 16px;${border}font-family:${FONT};">
    <p class="ink" style="margin:0;font-size:16.5px;line-height:24px;font-weight:600;color:${C.ink};">${esc(it.title)}</p>
    ${it.text ? `<p class="muted" style="margin:3px 0 0;font-size:14.5px;line-height:23px;color:${C.muted};">${lines(it.text)}</p>` : ''}
  </td>
</tr>`;
  })
  .join('\n')}
</table>`,
        '38px 36px 0',
      ),
    );
  }

  const href = c.button
    ? k.link(c.button.url, k.raw.button?.label || c.button.label)
    : '';
  const cta = href
    ? buttonHtml({
        href,
        label: c.button.label,
        bg: C.ink,
        fg: C.white,
        inkClass: true,
      })
    : '';
  rows.push(
    section(
      `${cta}\n${signoffHtml(c.signoff, cta ? 30 : 0)}`,
      '34px 36px 48px',
    ),
  );

  // text
  k.text.push(headlineText(c.headline), '');
  if (paragraphs(c.body).length) k.text.push(textParagraphs(c.body), '');
  if (r && r.title) {
    k.text.push(
      [r.title, r.subtitle].filter(Boolean).join(' (') +
        (r.subtitle ? ')' : ''),
    );
    if (resumeHref)
      k.text.push(
        `${r.buttonLabel || 'Pick up where you left off'}: ${resumeHref}`,
      );
    k.text.push('');
  }
  if (list.length) {
    k.text.push((c.itemsTitle || '').trim() || 'New since you were here');
    textItems(k, list, 'none');
  }
  if (href) textButton(k, c.button.label, href);
  return { rows: rows.join('\n') };
}

function initials(name: string): string {
  return (name || '')
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function live(k: Kit): Body {
  const { c, lead, set } = k;
  const lc = leadCls(lead);
  const e = c.event || ({} as CampaignContent['event']);
  const avatar =
    set === 'purple_cream'
      ? { bg: C.cream, fg: C.ink }
      : { bg: C.purple, fg: C.white };
  const rows: string[] = [];

  rows.push(
    section(
      headerHtml(
        k.ctx,
        logoHtml(lead.logoBg, lead.logoFg, lead.text, lc.text),
        { color: lead.muted, className: lc.muted },
      ),
      '24px 36px',
    ),
  );

  const tile = `<table role="presentation" width="132" cellpadding="0" cellspacing="0" border="0" style="width:132px;border-collapse:separate;">
        <tr>
          <td align="center" bgcolor="${lead.accent}" style="background:${lead.accent};border-radius:6px;padding:16px 14px;font-family:${FONT};color:${lead.onAccent};">
            <p style="margin:0;font-size:15px;line-height:20px;font-weight:600;letter-spacing:0.04em;color:${lead.onAccent};">${esc(e.weekday || '')}</p>
            <p style="margin:2px 0;font-size:64px;line-height:64px;font-weight:700;letter-spacing:-0.05em;color:${lead.onAccent};mso-line-height-rule:exactly;">${esc(e.day || '')}</p>
            <p style="margin:0;font-size:15px;line-height:20px;font-weight:600;letter-spacing:0.04em;color:${lead.onAccent};">${esc(e.month || '')}</p>
            ${e.time ? `<p style="margin:8px 0 0;padding-top:8px;border-top:1.5px solid ${lead.onAccent};font-size:13px;line-height:18px;font-weight:600;color:${lead.onAccent};">${esc(e.time)}</p>` : ''}
          </td>
        </tr>
      </table>`;
  rows.push(
    section(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td width="132" valign="middle" class="stack tile-cell" style="width:132px;">
      ${tile}
    </td>
    <td width="22" class="stack-gap" style="width:22px;font-size:0;line-height:0;">&nbsp;</td>
    <td valign="middle" class="stack live-h">
      <h1${cls('fs-40', lc.text)} style="margin:0;font-family:${FONT};font-size:40px;line-height:42px;font-weight:600;letter-spacing:-0.035em;color:${lead.text};">${headlineHtml(c.headline, c.highlight, { bg: lead.markBg, fg: lead.markFg, pad: 8 })}</h1>
    </td>
  </tr>
</table>`,
      '24px 36px 0',
    ),
  );

  if (paragraphs(c.body).length)
    rows.push(
      section(
        paragraphsHtml(
          c.body,
          `font-size:17px;line-height:28px;color:${lead.soft};`,
          lc.soft,
        ),
        '30px 36px 0',
      ),
    );

  if (e.host) {
    rows.push(
      section(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
  <tr>
    <td bgcolor="${lead.panel}"${cls(lc.panel)} style="background:${lead.panel};border-radius:6px;padding:18px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="52" valign="middle" style="width:52px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr>
              <td width="52" height="52" align="center" valign="middle" bgcolor="${avatar.bg}" style="width:52px;height:52px;background:${avatar.bg};border-radius:999px;font-family:${FONT};font-size:17px;font-weight:700;line-height:52px;color:${avatar.fg};">${esc(initials(e.host))}</td>
            </tr></table>
          </td>
          <td valign="middle" style="padding-left:14px;font-family:${FONT};">
            <p${cls(lc.text)} style="margin:0;font-size:16px;line-height:22px;font-weight:600;color:${lead.text};">${esc(e.host)}</p>
            ${e.hostRole ? `<p${cls(lc.muted)} style="margin:2px 0 0;font-size:13.5px;line-height:20px;color:${lead.muted};">${esc(e.hostRole)}</p>` : ''}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
        '30px 36px 0',
      ),
    );
  }

  const list = items(c);
  if (list.length) {
    const title = (c.itemsTitle || '').trim() || 'In the hour';
    rows.push(
      section(
        `<h2${cls(lc.muted)} style="margin:0 0 4px;font-family:${FONT};font-size:13px;line-height:20px;font-weight:600;color:${lead.muted};">${esc(title)}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${list
  .map(
    (it) => `<tr>
  <td width="56" valign="top"${cls(lead.white && 'rule')} style="width:56px;padding:14px 0;border-bottom:1px solid ${lead.line};font-family:${FONT};font-size:14px;line-height:24px;font-weight:600;color:${lead.accentText};white-space:nowrap;"><span${cls(lead.white && 'tone')}>${esc(it.title)}</span></td>
  <td valign="top"${cls(lead.white && 'rule', lc.text)} style="padding:14px 0 14px 18px;border-bottom:1px solid ${lead.line};font-family:${FONT};font-size:16px;line-height:24px;color:${lead.text};">${lines(it.text)}</td>
</tr>`,
  )
  .join('\n')}
</table>`,
        '30px 36px 0',
      ),
    );
  }

  const href = c.button
    ? k.link(c.button.url, k.raw.button?.label || c.button.label)
    : '';
  const cal = k.link(e.calendarUrl, 'Add to calendar');
  const cta = href
    ? buttonHtml({
        href,
        label: c.button.label,
        bg: lead.accent,
        fg: lead.onAccent,
      })
    : '';
  const calLink = cal
    ? `<a href="${esc(cal)}" target="_blank"${cls(lc.text)} style="font-family:${FONT};font-size:15px;line-height:20px;font-weight:600;color:${lead.text};text-decoration:underline;">Add to calendar</a>`
    : '';
  rows.push(
    section(
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
  <tr>
    ${cta ? `<td valign="middle" class="stack">${cta}</td>` : ''}
    ${cta && calLink ? `<td width="24" class="stack-gap" style="width:24px;font-size:0;line-height:0;">&nbsp;</td>` : ''}
    ${calLink ? `<td valign="middle" class="stack cal-cell">${calLink}</td>` : ''}
  </tr>
</table>`,
      '34px 36px 48px',
    ),
  );

  // text
  k.text.push(headlineText(c.headline), '');
  k.text.push(
    [[e.weekday, e.day, e.month].filter(Boolean).join(' '), e.time]
      .filter(Boolean)
      .join(', '),
    '',
  );
  if (paragraphs(c.body).length) k.text.push(textParagraphs(c.body), '');
  if (e.host)
    k.text.push(`Host: ${e.host}${e.hostRole ? `, ${e.hostRole}` : ''}`, '');
  if (list.length) {
    k.text.push((c.itemsTitle || '').trim() || 'In the hour');
    textItems(k, list, 'time');
  }
  if (href) textButton(k, c.button.label, href);
  if (cal) textButton(k, 'Add to calendar', cal);
  return { rows: rows.join('\n'), cardBg: lead.bg, cardWhite: lead.white };
}

function letter(k: Kit): Body {
  const { c, set } = k;
  const mark = MARK_ON_WHITE[set];
  const btn = LETTER_BUTTON[set];
  const rows: string[] = [];

  // A letter has no hero: the colour set shows as a thin rule along the top (none for the white
  // lead), the marker and the button.
  const lead = LEADS[set];
  if (!lead.white)
    rows.push(
      `<tr><td height="6" bgcolor="${lead.bg}" style="height:6px;background:${lead.bg};font-size:0;line-height:0;">&nbsp;</td></tr>`,
    );
  rows.push(
    section(
      headerHtml(k.ctx, logoHtml(C.purple, C.white, C.ink, 'ink'), {
        color: C.muted2,
        className: 'muted',
      }),
      '32px 36px 0',
    ),
  );
  rows.push(
    section(
      `${(c.headline || '').trim() ? `<h1 class="ink" style="margin:0 0 18px;font-family:${FONT};font-size:26px;line-height:34px;font-weight:600;letter-spacing:-0.015em;color:${C.ink};">${headlineHtml(c.headline, c.highlight, { ...mark, pad: 6 })}</h1>` : ''}
${paragraphsHtml(c.body, `font-size:16px;line-height:26px;color:${C.body};`, 'body', 16)}`,
      '36px 36px 0',
    ),
  );
  const href = c.button
    ? k.link(c.button.url, k.raw.button?.label || c.button.label)
    : '';
  const cta = href
    ? buttonHtml({
        href,
        label: c.button.label,
        bg: btn.bg,
        fg: btn.fg,
        size: 'sm',
        inkClass: btn.bg === C.ink,
      })
    : '';
  rows.push(
    section(
      `${cta}\n${signoffHtml(c.signoff, cta ? 28 : 0)}`,
      `${cta ? 26 : 22}px 36px 44px`,
    ),
  );

  // text
  if ((c.headline || '').trim()) k.text.push(headlineText(c.headline), '');
  k.text.push(textParagraphs(c.body), '');
  if (href) textButton(k, c.button.label, href);
  return { rows: rows.join('\n') };
}

const RENDERERS: Record<TemplateKey, (k: Kit) => Body> = {
  announcement,
  newsletter,
  offer,
  spotlight,
  comeback,
  live,
  letter,
};

/* ------------------------------------------------------------------ document shell */

const HEAD_STYLE = `
  body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse; mso-table-lspace:0; mso-table-rspace:0; }
  img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  a { color:${C.purple}; }
  @media (max-width: 620px) {
    .outer { padding:0 !important; }
    .px { padding-left:22px !important; padding-right:22px !important; }
    .stack { display:block !important; width:100% !important; box-sizing:border-box !important; }
    .stack-gap { display:block !important; width:100% !important; height:12px !important; }
    .tile-cell { width:132px !important; }
    .live-h { padding-top:6px !important; }
    .cal-cell { padding-top:16px !important; }
    .code-cell { text-align:left !important; padding:6px 0 0 !important; }
    .img-fluid { width:100% !important; height:auto !important; }
    .numcol { width:48px !important; font-size:32px !important; line-height:34px !important; }
    .numgap { padding-left:14px !important; }
    .fs-190 { font-size:120px !important; line-height:106px !important; }
    .fs-84 { font-size:62px !important; line-height:60px !important; }
    .fs-66 { font-size:48px !important; line-height:50px !important; }
    .fs-60 { font-size:40px !important; line-height:44px !important; }
    .fs-54 { font-size:38px !important; line-height:42px !important; }
    .fs-40 { font-size:31px !important; line-height:35px !important; }
    .fs-34 { font-size:28px !important; line-height:32px !important; }
    .fs-30 { font-size:25px !important; line-height:30px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .bg { background:#0f0f12 !important; }
    .card { background:#17171b !important; }
    .panel { background:#202026 !important; }
    .ink { color:#f3f3f5 !important; }
    .body { color:#c9c9d1 !important; }
    .muted { color:#a3a3ad !important; }
    .link { color:#b09afb !important; }
    .tone, .tone-num { color:#b09afb !important; }
    .rule { border-color:#2b2b32 !important; }
    .tone-border { border-color:#b09afb !important; }
    .code-box { border-color:#a3a3ad !important; }
    .btn-ink { background:#f3f3f5 !important; color:#0e0e10 !important; }
  }`;

/** Kept in its own block: a client that drops @supports keeps the main styles, and the photo stays uncropped. */
const CROP_STYLE = `
  @supports (object-fit: cover) {
    .crop-340 { height:340px !important; object-fit:cover !important; object-position:center 30% !important; }
    .crop-300 { height:300px !important; object-fit:cover !important; object-position:center 30% !important; }
    @media (max-width: 620px) {
      .crop-340 { height:220px !important; }
      .crop-300 { height:190px !important; }
    }
  }`;

function shell(
  ctx: RenderContext,
  title: string,
  preheader: string,
  body: Body,
): string {
  const unsub = esc(ctx.unsubscribeUrl);
  const cardBg = body.cardBg || C.white;
  const cardCls = !body.cardBg || body.cardWhite ? 'card' : undefined;
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(title)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><style>body, table, td, p, a, span, h1, h2 { font-family: Helvetica, Arial, sans-serif !important; }</style><![endif]-->
<link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400&display=swap" rel="stylesheet">
<style>${HEAD_STYLE}
</style>
<style>${CROP_STYLE}
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(preheader)}${'&#847;&zwnj;&nbsp;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" bgcolor="${C.page}" style="background:${C.page};">
  <tr>
    <td align="center" class="outer" style="padding:24px 12px 0;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <tr>
          <td${cls(cardCls)} bgcolor="${cardBg}" style="background:${cardBg};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${body.rows}
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" class="px" style="padding:32px 36px 40px;font-family:${FONT};">
            <p class="muted" style="margin:0;font-size:12.5px;line-height:20px;color:${C.muted2};">You’re getting this because you have an AI Examiner account.<br><a class="link" href="${unsub}" target="_blank" style="color:${C.purple};text-decoration:underline;">Unsubscribe</a> &middot; <a class="link" href="${unsub}" target="_blank" style="color:${C.purple};text-decoration:underline;">Email settings</a></p>
            <p class="muted" style="margin:10px 0 0;font-size:12.5px;line-height:20px;color:${C.muted2};">AI Examiner &middot; ${esc(ctx.postalAddress)} &middot; Built by Medical students</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/* ------------------------------------------------------------------ entry point */

export function renderMarketingEmail(
  key: TemplateKey,
  content: CampaignContent,
  ctx: RenderContext,
): RenderedMarketingEmail {
  const render = RENDERERS[key];
  if (!render) throw new Error(`Unknown marketing template: ${key}`);

  const c = mergeDeep(content, ctx.firstName);
  const set: ColorSet = LEADS[c.colorSet] ? c.colorSet : 'ink_yellow';
  const text: string[] = [];
  const kit: Kit = {
    c,
    raw: content,
    ctx,
    set,
    lead: LEADS[set],
    text,
    link: (url, label) => {
      const u = safeUrl(url);
      return u ? ctx.trackLink(u, label || '') : '';
    },
  };

  const viewUrl = safeUrl(ctx.viewInBrowserUrl, false);
  if (viewUrl) text.push(`View in browser: ${viewUrl}`, '');

  const body = render(kit);

  if (c.signoff && c.signoff.trim() && key !== 'offer' && key !== 'live')
    text.push(c.signoff.trim(), TEAM, '');
  text.push(
    '---',
    'You’re getting this because you have an AI Examiner account.',
    `Unsubscribe or change your email settings: ${ctx.unsubscribeUrl}`,
    `AI Examiner · ${ctx.postalAddress} · Built by Medical students`,
  );

  const title = mergeFirstName(ctx.subject || '', ctx.firstName);
  const preheader = mergeFirstName(ctx.preheader || '', ctx.firstName);
  return {
    html: shell(ctx, title, preheader, body),
    text: text
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  };
}
