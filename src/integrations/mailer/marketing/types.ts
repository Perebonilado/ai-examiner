/**
 * Marketing email content. One shape for every template: each template uses the fields its
 * catalog entry lists (see templates.ts) and ignores the rest.
 */

export type TemplateKey =
  | 'announcement'
  | 'newsletter'
  | 'offer'
  | 'spotlight'
  | 'comeback'
  | 'live'
  | 'letter';

/** Two-colour sets the admin can pick in the editor (first colour leads, second accents). */
export type ColorSet =
  | 'ink_yellow'
  | 'yellow_ink'
  | 'purple_cream'
  | 'white_purple';

export interface ContentItem {
  title: string;
  text: string;
}

export interface CampaignContent {
  colorSet: ColorSet;
  headline: string;
  /** A word or phrase inside `headline` to set on the yellow marker. Optional. */
  highlight?: string;
  /** The short line under the headline (announcement and spotlight heroes, the newsletter's
   *  lead story). Optional. */
  subhead?: string;
  /** Paragraphs separated by a blank line. May contain {first name}. */
  body: string;
  imageUrl?: string;
  imageAlt?: string;
  button?: { label: string; url: string };
  /** Numbered highlights (announcement), tips (newsletter), steps (spotlight), what you get
   *  (offer), what's new (comeback), agenda (live: title = time, text = what). */
  items?: ContentItem[];
  /** The heading over `items`, e.g. "Three taps to try it". Optional: each template has a fallback. */
  itemsTitle?: string;
  /** Newsletter quote block. */
  quote?: { text: string; by: string };
  /** Newsletter: two colour-block cards. */
  cards?: { title: string; text: string; linkLabel: string; url: string }[];
  /** Offer template. */
  offer?: {
    intro: string; // "Exam season offer"
    big: string; // "30%"
    line: string; // "off the Quarterly plan"
    deadline: string; // "Ends Sunday 30 November, midnight"
    deadlineNote?: string; // "3 days left"
    code?: string; // "EXAM30"
    fineprint?: string;
  };
  /** Live session template. */
  event?: {
    weekday: string; // "THU"
    day: string; // "4"
    month: string; // "DEC"
    time: string; // "7 pm WAT"
    host: string;
    hostRole: string;
    calendarUrl?: string;
  };
  /** Spotlight template: the same paragraph before and after Easy Read. */
  beforeAfter?: { before: string; after: string };
  /** Come back template: the card naming where they left off. */
  resume?: {
    title: string;
    subtitle: string;
    progress?: number;
    buttonLabel: string;
    url: string;
  };
  /** Newsletter masthead line, e.g. "No. 11 · November 2026". */
  issueLabel?: string;
  /** e.g. "Happy studying," (the team name is added on the next line). */
  signoff?: string;
}

/** Everything the renderer needs besides the content. */
export interface RenderContext {
  subject: string;
  preheader: string;
  /** The recipient's first name; {first name} becomes this, or "there" when missing. */
  firstName?: string | null;
  /** Wraps every link in the email for click tracking. Return the url unchanged to skip. */
  trackLink: (url: string, label: string) => string;
  /** Where "Unsubscribe" and "Email settings" go. */
  unsubscribeUrl: string;
  /** "View in browser" link, optional. */
  viewInBrowserUrl?: string;
  /** Postal address for the footer (required in marketing email). */
  postalAddress: string;
}

export interface RenderedMarketingEmail {
  html: string;
  text: string;
}
