/**
 * The one layout every AI Examiner email uses. Email-safe: table layout and inline styles, with a
 * <style> block only for phone widths and dark mode (clients that drop it keep the inline styles).
 * Every email is returned as HTML with a plain-text twin.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** A heading is plain text, with at most a word or two on the yellow marker: ['Reset your ', { mark: 'password' }]. */
export type HeadingPart = string | { mark: string };

export interface EmailStep {
  state: 'done' | 'now' | 'next';
  title: string;
  text: string;
}

export interface EmailContent {
  subject: string;
  /** The grey preview line shown after the subject in the inbox. */
  preheader: string;
  heading: HeadingPart[];
  paragraphs: string[];
  button?: { label: string; url: string };
  /** A progress list, e.g. viva taken / marking / results. */
  steps?: EmailStep[];
  /** A box naming the thing the email is about, e.g. a document and when the viva was taken. */
  detail?: { title: string; meta: string };
  /** The one thing not to miss, on a cream panel. */
  note?: string;
  /** Shown under the card as "Button not working? Copy this link…". */
  fallbackUrl?: string;
}

const FONT = "Lexend, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const C = {
  canvas: '#f4f4f6',
  card: '#ffffff',
  ink: '#0e0e10',
  body: '#3f3f47',
  muted: '#6b6b74',
  line: '#ececef',
  purple: '#5b2ad6',
  yellow: '#f4cb5a',
  cream: '#fbf1cc',
  green: '#13794a',
  faint: '#d9d9de',
};
const SUPPORT = {
  email: 'aiexaminerapp@gmail.com',
  whatsappLabel: '+234 708 127 1903',
  whatsappUrl: 'https://wa.me/2347081271903',
  site: 'https://aiexaminer.app',
};

export const escapeHtml = (value: string): string =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const headingHtml = (parts: HeadingPart[]) =>
  parts
    .map((p) =>
      typeof p === 'string'
        ? escapeHtml(p)
        : `<span class="mark" style="background:${C.yellow};color:${C.ink};padding:0 6px;border-radius:4px;-webkit-box-decoration-break:clone;box-decoration-break:clone;">${escapeHtml(p.mark)}</span>`,
    )
    .join('');

const headingText = (parts: HeadingPart[]) =>
  parts.map((p) => (typeof p === 'string' ? p : p.mark)).join('');

const logo = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td width="30" height="30" align="center" valign="middle" bgcolor="${C.purple}" style="width:30px;height:30px;background:${C.purple};border-radius:8px;font-family:${FONT};font-size:13px;font-weight:700;line-height:30px;color:#ffffff;">AI</td>
    <td class="ink" style="padding-left:10px;font-family:${FONT};font-size:18px;font-weight:600;letter-spacing:-0.01em;color:${C.ink};">Examiner</td>
  </tr>
</table>`;

const buttonHtml = ({ label, url }: { label: string; url: string }) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 4px;">
  <tr>
    <td bgcolor="${C.purple}" style="background:${C.purple};border-radius:999px;">
      <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;

const STEP_STYLE: Record<EmailStep['state'], { bg: string; fg: string; glyph?: string; border?: string; size: number }> = {
  done: { bg: C.green, fg: '#ffffff', glyph: '&#10003;', size: 26 },
  now: { bg: C.purple, fg: '#ffffff', size: 26 },
  next: { bg: C.card, fg: C.muted, border: `1.5px solid ${C.faint}`, size: 23 },
};

const stepsHtml = (steps: EmailStep[]) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 2px;">
  ${steps
    .map((s, i) => {
      const st = STEP_STYLE[s.state];
      const gap = i === steps.length - 1 ? 0 : 18;
      const badge =
        s.state === 'now'
          ? `&nbsp;&nbsp;<span style="display:inline-block;padding:1px 8px;border-radius:999px;background:${C.cream};color:${C.ink};font-size:11.5px;font-weight:600;line-height:18px;vertical-align:1px;">In progress</span>`
          : '';
      return `<tr>
    <td width="28" valign="top" style="width:28px;padding:0 0 ${gap}px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr>
        <td width="${st.size}" height="${st.size}" align="center" valign="middle" class="${s.state === 'next' ? 'step-next' : ''}" bgcolor="${st.bg}" style="width:${st.size}px;height:${st.size}px;border-radius:13px;background:${st.bg};${st.border ? `border:${st.border};` : ''}font-family:${FONT};font-size:12px;font-weight:700;line-height:${st.size}px;color:${st.fg};">${st.glyph || i + 1}</td>
      </tr></table>
    </td>
    <td valign="top" style="padding:2px 0 ${gap}px 14px;font-family:${FONT};">
      <p class="ink" style="margin:0;font-size:15px;font-weight:${s.state === 'now' ? 600 : 500};line-height:22px;color:${C.ink};">${escapeHtml(s.title)}${badge}</p>
      <p class="muted" style="margin:2px 0 0;font-size:14px;line-height:21px;color:${C.muted};">${escapeHtml(s.text)}</p>
    </td>
  </tr>`;
    })
    .join('')}
</table>`;

const detailHtml = ({ title, meta }: { title: string; meta: string }) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;border-collapse:separate;">
  <tr>
    <td class="detail" style="border:1px solid ${C.line};border-radius:14px;padding:14px 16px;font-family:${FONT};">
      <p class="ink" style="margin:0;font-size:15px;font-weight:600;line-height:22px;color:${C.ink};">${escapeHtml(title)}</p>
      <p class="muted" style="margin:2px 0 0;font-size:13px;line-height:20px;color:${C.muted};">${escapeHtml(meta)}</p>
    </td>
  </tr>
</table>`;

const noteHtml = (note: string) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
  <tr>
    <td class="note" bgcolor="${C.cream}" style="background:${C.cream};border-radius:14px;padding:14px 16px;font-family:${FONT};font-size:14px;line-height:21px;color:${C.ink};">${escapeHtml(note)}</td>
  </tr>
</table>`;

const fallbackHtml = (url: string) =>
  `<p class="muted rule" style="margin:28px 0 0;padding-top:20px;border-top:1px solid ${C.line};font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted};">Button not working? Copy this link into your browser:<br><a class="link" href="${escapeHtml(url)}" target="_blank" style="color:${C.purple};word-break:break-all;">${escapeHtml(url)}</a></p>`;

export function renderEmail(o: EmailContent): RenderedEmail {
  const year = new Date().getFullYear();
  const paragraphs = o.paragraphs
    .map(
      (p) =>
        `<p class="body" style="margin:0 0 14px;font-family:${FONT};font-size:16px;line-height:26px;color:${C.body};">${escapeHtml(p)}</p>`,
    )
    .join('\n            ');

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(o.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse; mso-table-lspace:0; mso-table-rspace:0; }
  a { color:${C.purple}; }
  @media (max-width: 620px) {
    .outer { padding:16px 8px 28px !important; }
    .card { padding:30px 22px !important; border-radius:16px !important; }
    .h1 { font-size:24px !important; line-height:32px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .bg { background:#0f0f12 !important; }
    .card { background:#17171b !important; }
    .ink { color:#f3f3f5 !important; }
    .body { color:#c9c9d1 !important; }
    .muted { color:#a3a3ad !important; }
    .link { color:#b09afb !important; }
    .detail { border-color:#2b2b32 !important; }
    .rule { border-color:#2b2b32 !important; }
    .step-next { background:#17171b !important; border-color:#4a4a54 !important; }
    .note { background:#2a2412 !important; color:#f6e7b0 !important; }
  }
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:${C.canvas};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(o.preheader)}${'&#847;&zwnj;&nbsp;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" bgcolor="${C.canvas}" style="background:${C.canvas};">
  <tr>
    <td align="center" class="outer" style="padding:36px 16px 40px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <tr><td style="padding:0 6px 22px;"><a href="${SUPPORT.site}" target="_blank" style="text-decoration:none;" aria-label="AI Examiner">${logo}</a></td></tr>
        <tr>
          <td class="card" bgcolor="${C.card}" style="background:${C.card};border-radius:20px;padding:40px 44px;">
            <h1 class="ink h1" style="margin:0 0 18px;font-family:${FONT};font-size:28px;font-weight:600;line-height:38px;letter-spacing:-0.015em;color:${C.ink};">${headingHtml(o.heading)}</h1>
            ${paragraphs}
            ${o.detail ? detailHtml(o.detail) : ''}
            ${o.steps ? stepsHtml(o.steps) : ''}
            ${o.button ? buttonHtml(o.button) : ''}
            ${o.note ? noteHtml(o.note) : ''}
            ${o.fallbackUrl ? fallbackHtml(o.fallbackUrl) : ''}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:26px 12px 0;font-family:${FONT};">
            <p class="muted" style="margin:0;font-size:13px;line-height:20px;color:${C.muted};">Questions? Email <a class="link" href="mailto:${SUPPORT.email}" style="color:${C.purple};">${SUPPORT.email}</a> or message us on <a class="link" href="${SUPPORT.whatsappUrl}" target="_blank" style="color:${C.purple};">WhatsApp</a>.</p>
            <p class="muted" style="margin:10px 0 0;font-size:12px;line-height:18px;color:${C.muted};">You're getting this email because of activity on your AI Examiner account.<br>&copy; ${year} AI Examiner &middot; Built by Medical students</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const lines: string[] = [headingText(o.heading), ''];
  o.paragraphs.forEach((p) => lines.push(p, ''));
  if (o.detail) lines.push(`${o.detail.title} (${o.detail.meta})`, '');
  if (o.steps) {
    o.steps.forEach((s, i) => {
      const tag = s.state === 'done' ? '[done]' : s.state === 'now' ? '[now] ' : `[${i + 1}]   `;
      lines.push(`${tag} ${s.title}: ${s.text}`);
    });
    lines.push('');
  }
  if (o.button) lines.push(`${o.button.label}: ${o.button.url}`, '');
  if (o.note) lines.push(o.note, '');
  lines.push(
    '---',
    `Questions? Email ${SUPPORT.email} or WhatsApp ${SUPPORT.whatsappLabel}.`,
    `(c) ${year} AI Examiner`,
  );

  return { subject: o.subject, html, text: lines.join('\n') };
}
