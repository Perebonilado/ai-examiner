import { RenderedEmail, renderEmail } from './layout';

/** Every email AI Examiner sends, built on the shared layout. */

const greeting = (firstName?: string | null) =>
  firstName && firstName.trim() ? `Hi ${firstName.trim()},` : 'Hi there,';

/** Forgot password. The reset link is valid for 10 minutes. */
/** Sent after an email-and-password sign-up: the account opens once the address is confirmed. */
export const confirmEmailEmail = ({
  firstName,
  confirmUrl,
}: {
  firstName?: string | null;
  confirmUrl: string;
}): RenderedEmail =>
  renderEmail({
    subject: 'Confirm your email for AI Examiner',
    preheader: 'One tap and your account is ready.',
    heading: ['Confirm your ', { mark: 'email' }],
    paragraphs: [
      greeting(firstName),
      'Thanks for signing up to AI Examiner. Tap the button below to confirm this is your email address, and your account will be ready to use.',
    ],
    button: { label: 'Confirm my email', url: confirmUrl },
    note: "This link works for 7 days. If you didn't sign up for AI Examiner, you can ignore this email.",
    fallbackUrl: confirmUrl,
  });

export const resetPasswordEmail = ({
  firstName,
  resetUrl,
}: {
  firstName?: string | null;
  resetUrl: string;
}): RenderedEmail =>
  renderEmail({
    subject: 'Reset your AI Examiner password',
    preheader: 'Use this link within 10 minutes to choose a new password.',
    heading: ['Reset your ', { mark: 'password' }],
    paragraphs: [
      greeting(firstName),
      'We got a request to reset the password for your AI Examiner account. Tap the button below to choose a new one.',
    ],
    button: { label: 'Reset password', url: resetUrl },
    note: "This link expires in 10 minutes. If you didn't ask to reset your password, you can ignore this email and your password won't change.",
    fallbackUrl: resetUrl,
  });

/** Sent as soon as an oral viva call ends, before it has been marked. */
export const vivaMarkingEmail = ({
  firstName,
  documentTitle,
}: {
  firstName?: string | null;
  documentTitle?: string | null;
}): RenderedEmail =>
  renderEmail({
    subject: 'Your oral viva is being marked',
    preheader:
      "We'll email you a link to your results as soon as they're ready.",
    heading: ['Your viva is being ', { mark: 'marked' }],
    paragraphs: [
      greeting(firstName),
      documentTitle
        ? `Thanks for taking your oral viva on ${documentTitle}. Our examiner is going through your answers now.`
        : 'Thanks for taking your oral viva. Our examiner is going through your answers now.',
    ],
    steps: [
      {
        state: 'done',
        title: 'Viva taken',
        text: 'Your conversation with the examiner is saved.',
      },
      {
        state: 'now',
        title: 'Marking',
        text: 'Each answer is scored out of 10, with feedback.',
      },
      {
        state: 'next',
        title: 'Your results',
        text: "We'll email you a link as soon as they're ready.",
      },
    ],
    note: "Please don't retake this viva while it's being marked.",
  });

/** Sent once the viva has been marked, with a link to the results. */
export const vivaResultsEmail = ({
  firstName,
  documentTitle,
  takenOn,
  resultsUrl,
}: {
  firstName?: string | null;
  documentTitle?: string | null;
  takenOn: Date;
  resultsUrl: string;
}): RenderedEmail =>
  renderEmail({
    subject: 'Your viva results are ready',
    preheader: 'See your score and feedback on every question.',
    heading: ['Your viva results are ', { mark: 'ready' }],
    paragraphs: [
      greeting(firstName),
      'Your oral viva has been marked. See how you did on each question, read the feedback on what to strengthen, and play the conversation back.',
    ],
    detail: documentTitle
      ? {
          title: documentTitle,
          meta: `Oral viva · ${takenOn.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        }
      : undefined,
    button: { label: 'View my results', url: resultsUrl },
    fallbackUrl: resultsUrl,
  });
